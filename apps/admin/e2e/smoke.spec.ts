import { expect, test } from '@playwright/test';

test('abre o shell administrativo sem exigir login', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/MarkMap/i);
  await expect(page.getByText('MarkMap', { exact: true }).first()).toBeVisible();
});
