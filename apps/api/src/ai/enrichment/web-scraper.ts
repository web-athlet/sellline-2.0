import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';

/**
 * Fetches and text-extracts public web pages for enrichment, respecting robots.txt.
 * External I/O only — excluded from unit coverage; robots logic is exercised via
 * mocked `fetch` in enrichment.service tests.
 */
@Injectable()
export class WebScraper {
  private readonly logger = new Logger(WebScraper.name);
  private readonly userAgent = process.env.AI_SCRAPER_USER_AGENT ?? 'NextGenCRM-EnrichmentBot/1.0';
  private readonly timeoutMs = 10_000;
  private readonly maxChars = 4_000;

  /** Returns extracted page text, or null when disallowed by robots.txt or unfetchable. */
  async fetchAllowedText(url: string): Promise<string | null> {
    if (!(await this.isAllowed(url))) {
      this.logger.debug(`robots.txt disallows scraping ${url}`);
      return null;
    }
    const res = await this.fetchWithTimeout(url);
    if (!res || !res.ok) return null;
    const html = await res.text();
    return this.extractText(html);
  }

  /** robots.txt check. Fails open on fetch/parse errors; respects explicit Disallow. */
  async isAllowed(url: string): Promise<boolean> {
    try {
      const robotsUrl = `${new URL(url).origin}/robots.txt`;
      const res = await this.fetchWithTimeout(robotsUrl);
      if (!res || !res.ok) return true; // no robots.txt → allowed by convention
      const robots = robotsParser(robotsUrl, await res.text());
      return robots.isAllowed(url, this.userAgent) ?? true;
    } catch (err) {
      this.logger.debug(`robots.txt check failed for ${url}: ${String(err)}`);
      return true;
    }
  }

  private extractText(html: string): string {
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, head').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return text.slice(0, this.maxChars);
  }

  private async fetchWithTimeout(url: string): Promise<Response | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': this.userAgent },
      });
    } catch (err) {
      this.logger.debug(`fetch failed for ${url}: ${String(err)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
