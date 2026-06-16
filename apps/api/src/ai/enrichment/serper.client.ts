import { Injectable, Logger } from '@nestjs/common';

/** Thrown when Serper returns HTTP 429 (monthly credit quota exhausted). */
export class SerperQuotaError extends Error {
  constructor(message = 'Serper quota exhausted (HTTP 429)') {
    super(message);
    this.name = 'SerperQuotaError';
  }
}

export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
}

const SERPER_ENDPOINT = 'https://google.serper.dev/search';

/**
 * Thin wrapper around the Serper Google-Search API (DSGVO-konform: kein eigener
 * Crawler). External I/O only — excluded from unit coverage; exercised via mocked
 * `fetch` in enrichment.service tests.
 */
@Injectable()
export class SerperClient {
  private readonly logger = new Logger(SerperClient.name);
  private readonly apiKey = process.env.SERPER_API_KEY;

  get configured(): boolean {
    return !!this.apiKey;
  }

  /** Returns up to `num` organic results. Empty array when unconfigured. Throws SerperQuotaError on 429. */
  async search(query: string, num = 5): Promise<SerperResult[]> {
    if (!this.apiKey) return [];

    const res = await fetch(SERPER_ENDPOINT, {
      method: 'POST',
      headers: { 'X-API-KEY': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num }),
    });

    if (res.status === 429) throw new SerperQuotaError();
    if (!res.ok) throw new Error(`Serper search failed: HTTP ${res.status}`);

    const data = (await res.json()) as {
      organic?: { title?: string; link?: string; snippet?: string }[];
    };

    return (data.organic ?? []).slice(0, num).map((o) => ({
      title: o.title ?? '',
      link: o.link ?? '',
      snippet: o.snippet ?? '',
    }));
  }
}
