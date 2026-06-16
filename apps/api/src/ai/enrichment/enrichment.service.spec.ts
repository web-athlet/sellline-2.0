import { EnrichmentStatus } from '@nextgen/db';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrichmentService } from './enrichment.service';
import { SerperClient, SerperQuotaError } from './serper.client';
import { WebScraper } from './web-scraper';
import { ScoringService } from '../scoring/scoring.service';
import { countFilledFields, normalizeFields } from './enrichment.types';

const makeLead = (overrides = {}) => ({
  id: 'lead-1',
  source: 'form:f1',
  companyName: 'Acme GmbH',
  emailDomain: 'acme.de',
  dataJson: { email: 'max@acme.de', phone: '+49 30 1234' },
  enrichedJson: null,
  enrichmentStatus: EnrichmentStatus.PENDING,
  convertedDealId: null,
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const prismaMock = {
  lead: { findFirst: vi.fn(), update: vi.fn() },
  organization: { upsert: vi.fn() },
  aIInsight: { create: vi.fn() },
  $executeRawUnsafe: vi.fn(),
};
const eventsMock = { emitLeadEnriched: vi.fn() };
const serperMock = { search: vi.fn() };
const scraperMock = { fetchAllowedText: vi.fn() };
const scoringMock = { enqueue: vi.fn() };
const openaiMock = {
  chat: { completions: { create: vi.fn() } },
  embeddings: { create: vi.fn() },
};

const make = (openai: unknown = openaiMock) =>
  new EnrichmentService(
    prismaMock as unknown as PrismaService,
    eventsMock as unknown as EventsGateway,
    serperMock as unknown as SerperClient,
    scraperMock as unknown as WebScraper,
    scoringMock as unknown as ScoringService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    openai as any,
  );

const insightContents = () => prismaMock.aIInsight.create.mock.calls.map((c) => c[0].data.content);

describe('EnrichmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.lead.findFirst.mockResolvedValue(makeLead());
    prismaMock.lead.update.mockResolvedValue({});
    prismaMock.organization.upsert.mockResolvedValue({ id: 'org-1' });
    prismaMock.aIInsight.create.mockResolvedValue({});
    prismaMock.$executeRawUnsafe.mockResolvedValue(1);
    openaiMock.embeddings.create.mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
  });

  it('returns early when the lead is missing', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    await make().enrich('nope');
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it('skips already-converted leads', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(makeLead({ convertedDealId: 'deal-9' }));
    await make().enrich('lead-1');
    expect(serperMock.search).not.toHaveBeenCalled();
  });

  it('runs the full pipeline and fills ≥4 of 7 fields with cost tracking (AC-025)', async () => {
    serperMock.search.mockResolvedValue([
      { title: 'Acme', link: 'https://acme.de', snippet: 'B2B SaaS aus Berlin' },
      { title: 'Acme About', link: 'https://acme.de/about', snippet: '120 Mitarbeiter' },
      { title: 'Acme Jobs', link: 'https://acme.de/jobs', snippet: 'wir stellen ein' },
    ]);
    scraperMock.fetchAllowedText.mockResolvedValue('Impressum: Acme GmbH, Berlin');
    openaiMock.chat.completions.create.mockResolvedValue({
      usage: { prompt_tokens: 2300, completion_tokens: 450 },
      choices: [
        {
          message: {
            content: JSON.stringify({
              branche: 'SaaS',
              mitarbeiterzahl: 120,
              jahresumsatz: 5_000_000,
              headquarter: 'Berlin',
              techStack: ['Node', 'React'],
              socialProfiles: { linkedin: 'https://linkedin.com/company/acme' },
            }),
          },
        },
      ],
    });

    await make().enrich('lead-1');

    // Lead marked DONE with enrichedJson.
    expect(prismaMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-1' },
        data: expect.objectContaining({ enrichmentStatus: EnrichmentStatus.DONE }),
      }),
    );
    // Organization upserted by domain.
    expect(prismaMock.organization.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { domain: 'acme.de' } }),
    );
    // AIInsight: complete + ≥4 fields + cost.
    const complete = insightContents().find((c) => c.status === 'complete');
    expect(complete).toBeTruthy();
    expect(countFilledFields(normalizeFields(complete.fields))).toBeGreaterThanOrEqual(4);
    expect(complete.cost.estCostUsd).toBeGreaterThan(0);
    expect(complete.cost.openaiTokensIn).toBe(2300);
    // Downstream: event + scoring enqueued.
    expect(eventsMock.emitLeadEnriched).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 'lead-1', status: 'DONE' }),
    );
    expect(scoringMock.enqueue).toHaveBeenCalledWith('lead-1');
  });

  it('falls back to a partial insight on Serper 429 and still passes the lead through (AC-Fallback)', async () => {
    serperMock.search.mockRejectedValue(new SerperQuotaError());

    await make().enrich('lead-1');

    const partial = insightContents().find((c) => c.status === 'partial');
    expect(partial).toMatchObject({ status: 'partial', reason: 'serper_quota' });
    expect(prismaMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enrichmentStatus: EnrichmentStatus.DONE }),
      }),
    );
    expect(openaiMock.chat.completions.create).not.toHaveBeenCalled();
    expect(eventsMock.emitLeadEnriched).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DONE' }),
    );
    expect(scoringMock.enqueue).toHaveBeenCalledWith('lead-1');
  });

  it('records a partial insight when Serper returns no results', async () => {
    serperMock.search.mockResolvedValue([]);
    await make().enrich('lead-1');
    expect(insightContents().find((c) => c.status === 'partial')?.reason).toBe('serper_empty');
  });

  it('records a partial insight when OpenAI is unconfigured', async () => {
    serperMock.search.mockResolvedValue([
      { title: 'Acme', link: 'https://acme.de', snippet: 'B2B SaaS' },
    ]);
    scraperMock.fetchAllowedText.mockResolvedValue(null);
    await make(null).enrich('lead-1');
    expect(insightContents().find((c) => c.status === 'partial')?.reason).toBe(
      'openai_not_configured',
    );
  });

  it('records a partial insight when there is no company signal (generic email, no company)', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(
      makeLead({ companyName: null, emailDomain: 'gmail.com' }),
    );
    await make().enrich('lead-1');
    expect(serperMock.search).not.toHaveBeenCalled();
    expect(insightContents().find((c) => c.status === 'partial')?.reason).toBe('no_company_signal');
  });

  it('skips Organization upsert when the domain is generic but a company name exists', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(
      makeLead({ companyName: 'Acme GmbH', emailDomain: 'gmail.com' }),
    );
    serperMock.search.mockResolvedValue([
      { title: 'Acme', link: 'https://acme.example', snippet: 'SaaS' },
    ]);
    scraperMock.fetchAllowedText.mockResolvedValue(null);
    openaiMock.chat.completions.create.mockResolvedValue({
      usage: { prompt_tokens: 100, completion_tokens: 20 },
      choices: [{ message: { content: JSON.stringify({ branche: 'SaaS' }) } }],
    });

    await make().enrich('lead-1');

    expect(prismaMock.organization.upsert).not.toHaveBeenCalled();
    expect(insightContents().find((c) => c.status === 'complete')?.orgId ?? null).toBeNull();
  });

  it('re-throws unexpected Serper errors so BullMQ retries', async () => {
    serperMock.search.mockRejectedValue(new Error('boom'));
    await expect(make().enrich('lead-1')).rejects.toThrow('boom');
  });

  it('marks the lead FAILED on dead-letter', async () => {
    await make().handleDeadLetter('lead-1', 'boom');
    expect(prismaMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { enrichmentStatus: EnrichmentStatus.FAILED } }),
    );
    expect(eventsMock.emitLeadEnriched).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED' }),
    );
  });
});
