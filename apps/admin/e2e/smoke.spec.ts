import { expect, test } from '@playwright/test';

test('abre o shell administrativo sem exigir login', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/MarkMap/i);
  // A sidebar fica oculta abaixo de lg e a topbar acima de sm: escolher a
  // marca visível no viewport em uso em vez do primeiro match do DOM.
  await expect(
    page.locator('[aria-label="MarkMap — Planejamento Inteligente"]:visible').first(),
  ).toBeVisible();
});
