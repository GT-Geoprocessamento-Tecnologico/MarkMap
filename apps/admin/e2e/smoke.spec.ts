import { expect, test } from '@playwright/test';

test('abre o shell administrativo sem exigir login', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/GeoNexo/i);
  await expect(page.getByText('GeoNexo', { exact: true }).first()).toBeVisible();
});
