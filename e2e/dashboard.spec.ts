import { expect, test } from '@playwright/test';
import { loginAsSeededUser } from './helpers';

/**
 * Happy-path 5: Add a dashboard widget → move it → save → refresh → persists.
 * SCAFFOLD. Exercises the react-grid-layout persistence on /insights.
 */
test.describe('Insights dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeededUser(page);
  });

  test('add a widget, move it, save and confirm it persists after refresh', async ({ page }) => {
    await page.goto('/insights');

    // 1. Add a widget.
    await page.getByRole('button', { name: /add widget|widget hinzufügen/i }).click();
    await page.getByRole('menuitem', { name: /deals by stage|deals nach phase/i }).click();
    const widget = page.getByTestId('dashboard-widget').last();
    await expect(widget).toBeVisible();

    // 2. Move it (drag by its header handle).
    await widget.getByTestId('widget-drag-handle').dragTo(page.getByTestId('grid-cell').nth(2));

    // 3. Save the layout.
    await page.getByRole('button', { name: /save layout|layout speichern/i }).click();
    await expect(page.getByText(/saved|gespeichert/i)).toBeVisible();

    // 4. Reload — the widget is still there.
    await page.reload();
    await expect(page.getByTestId('dashboard-widget')).toHaveCount(await widget.count());
  });
});
