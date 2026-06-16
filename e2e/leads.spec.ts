import { expect, test } from '@playwright/test';
import { loginAsSeededUser } from './helpers';

/**
 * Happy-path 3: CSV lead import → Enrichment run → Auto-convert to Deal. SCAFFOLD.
 * Requires the enrichment worker (or a stubbed enrichment mode) — see README.
 */
test.describe('Lead import & enrichment', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeededUser(page);
  });

  test('import a CSV, run enrichment and auto-convert a high-scoring lead', async ({ page }) => {
    await page.goto('/leads');

    // 1. Upload a CSV of leads.
    await page.getByRole('button', { name: /import/i }).click();
    await page.getByLabel(/csv|file|datei/i).setInputFiles({
      name: 'leads.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('email,company\nada@acme.io,Acme GmbH\n'),
    });
    await page.getByRole('button', { name: /upload|importieren/i }).click();
    await expect(page.getByText(/acme/i)).toBeVisible();

    // 2. Trigger enrichment and wait for the status to settle.
    await page
      .getByRole('button', { name: /enrich|anreichern/i })
      .first()
      .click();
    await expect(page.getByText(/done|fertig/i)).toBeVisible({ timeout: 30_000 });

    // 3. A lead scoring ≥ 80 auto-converts; verify the resulting deal exists.
    await page.goto('/deals');
    await expect(page.getByText(/acme/i)).toBeVisible();
  });
});
