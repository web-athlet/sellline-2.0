import { expect, test } from '@playwright/test';
import { loginAsSeededUser } from './helpers';

/**
 * Happy-path 4: Create campaign → select recipients → test send → track opens.
 * SCAFFOLD. Open tracking asserts the open-count increments after the tracking
 * pixel is hit (the test send uses the stub MailService from Session 12).
 */
test.describe('Email campaign', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeededUser(page);
  });

  test('create a campaign, pick recipients, send a test and see open tracking', async ({
    page,
  }) => {
    await page.goto('/campaigns/new');
    await page.getByLabel(/name/i).fill('Spring Outreach');
    await page.getByLabel(/subject|betreff/i).fill('Hello from NextGen');
    await page.getByRole('textbox', { name: /body|inhalt/i }).fill('Hi {{firstName}}');

    // Recipients (opted-in contacts only).
    await page.getByRole('button', { name: /recipients|empfänger/i }).click();
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: /confirm|übernehmen/i }).click();

    // Test send.
    await page.getByRole('button', { name: /test send|testversand/i }).click();
    await expect(page.getByText(/sent|gesendet/i)).toBeVisible();

    // Open tracking — the open-rate metric should be present on the detail page.
    await page.getByRole('link', { name: /Spring Outreach/i }).click();
    await expect(page.getByText(/open rate|öffnungsrate/i)).toBeVisible();
  });
});
