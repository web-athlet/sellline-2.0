import { expect, test } from '@playwright/test';

/**
 * Happy-path 1: Registration → Login. SCAFFOLD — see e2e/README.md.
 * 2FA-enabled accounts additionally pass through /2fa-challenge (not exercised
 * here because the TOTP secret must be seeded out-of-band).
 */
test.describe('Auth', () => {
  test('a new user can register and then log in', async ({ page }) => {
    const email = `e2e-${Date.now()}@test.local`;
    const password = 'Sup3rSecret-Passw0rd';

    await page.goto('/register');
    await page.getByLabel(/name/i).fill('E2E User');
    await page.getByLabel(/email/i).fill(email);
    await page
      .getByLabel(/password/i)
      .first()
      .fill(password);
    await page.getByRole('button', { name: /register|sign up|registrieren/i }).click();

    // Registration lands on the dashboard or the login screen depending on flow.
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /log in|sign in|anmelden/i }).click();

    await expect(page).toHaveURL(/\/(pulse|deals|dashboard)/);
  });
});
