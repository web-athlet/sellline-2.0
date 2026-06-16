import { WebScraper } from './web-scraper';

const res = (init: { ok: boolean; status?: number; body?: string }) => ({
  ok: init.ok,
  status: init.status ?? (init.ok ? 200 : 404),
  text: async () => init.body ?? '',
});

describe('WebScraper (robots.txt)', () => {
  let scraper: WebScraper;

  beforeEach(() => {
    scraper = new WebScraper();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('respects Disallow: / and does not fetch the page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res({ ok: true, body: 'User-agent: *\nDisallow: /' }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await scraper.isAllowed('https://acme.de/about')).toBe(false);

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(res({ ok: true, body: 'User-agent: *\nDisallow: /' }));
    const text = await scraper.fetchAllowedText('https://acme.de/about');
    expect(text).toBeNull();
    // Only robots.txt is fetched; the page itself is never requested.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://acme.de/robots.txt');
  });

  it('scrapes and text-extracts when allowed (no robots.txt)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res({ ok: false, status: 404 })) // robots.txt missing → allowed
      .mockResolvedValueOnce(
        res({
          ok: true,
          body: '<html><body><script>ignore()</script><p>Hello World</p></body></html>',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const text = await scraper.fetchAllowedText('https://acme.de/impressum');
    expect(text).toBe('Hello World');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails open when robots.txt fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await scraper.isAllowed('https://acme.de/x')).toBe(true);
  });
});
