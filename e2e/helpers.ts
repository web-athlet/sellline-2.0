import { expect, type Page } from '@playwright/test';

/**
 * Logs in as the seeded E2E user. The credentials come from the E2E seed (see
 * e2e/README.md); override via env for non-default environments. SCAFFOLD.
 */
export async function loginAsSeededUser(page: Page): Promise<void> {
  const email = process.env.E2E_USER_EMAIL ?? 'e2e@test.local';
  const password = process.env.E2E_USER_PASSWORD ?? 'Sup3rSecret-Passw0rd';

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in|sign in|anmelden/i }).click();
  await expect(page).toHaveURL(/\/(pulse|deals|dashboard)/);
}
