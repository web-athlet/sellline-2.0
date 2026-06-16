import { expect, test } from '@playwright/test';
import { loginAsSeededUser } from './helpers';

/**
 * Happy-path 2: Contact → Deal → Stage move (drag-drop) → Close Won. SCAFFOLD.
 */
test.describe('Deal pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeededUser(page);
  });

  test('create a contact, open a deal, advance the stage and win it', async ({ page }) => {
    // 1. Create a contact.
    await page.goto('/contacts');
    await page.getByRole('button', { name: /new contact|neuer kontakt/i }).click();
    await page.getByLabel(/first name|vorname/i).fill('Grace');
    await page.getByLabel(/last name|nachname/i).fill('Hopper');
    await page.getByRole('button', { name: /save|speichern/i }).click();
    await expect(page.getByText('Grace Hopper')).toBeVisible();

    // 2. Create a deal on the Kanban board.
    await page.goto('/deals');
    await page.getByRole('button', { name: /new deal|neuer deal/i }).click();
    await page.getByLabel(/title|titel/i).fill('Grace — Enterprise');
    await page.getByLabel(/value|wert/i).fill('25000');
    await page.getByRole('button', { name: /save|speichern/i }).click();
    const card = page.getByText('Grace — Enterprise');
    await expect(card).toBeVisible();

    // 3. Drag the deal card to the next stage column.
    const targetColumn = page.getByTestId('stage-column').nth(1);
    await card.dragTo(targetColumn);

    // 4. Mark the deal Won.
    await card.click();
    await page.getByRole('button', { name: /won|gewonnen/i }).click();
    await expect(page.getByText(/won|gewonnen/i)).toBeVisible();
  });
});
