import { test, expect } from '@playwright/test';

test('editor overview button opens and closes the overview', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cm-editor')).toBeVisible();
  await page.getByRole('button', { name: 'Overview (O)' }).click();
  await expect(page.getByText(/Overview ·/)).toBeVisible();
  // Grid shows every slide
  const count = await page.locator('.slide-canvas').count();
  expect(count).toBeGreaterThan(10);
  await page.keyboard.press('Escape');
  await expect(page.getByText(/Overview ·/)).toBeHidden();
});

test('present opens the presentation window with overview and drawing', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('.cm-editor')).toBeVisible();

  const popupPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: /^present/i }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(popup.url()).toContain('role=audience');

  // Receives the deck and renders a slide
  await expect(popup.locator('.slide-canvas').first()).toBeVisible({ timeout: 10_000 });

  // Overview: O opens the grid, clicking a slide navigates and closes
  await popup.keyboard.press('o');
  await expect(popup.getByText(/Overview ·/)).toBeVisible();
  await popup.locator('button:has(.slide-canvas)').nth(2).click();
  await expect(popup.getByText(/Overview ·/)).toBeHidden();
  await expect(popup.locator('[data-slide-index="2"]').first()).toBeVisible();

  // Editor followed the navigation from the presentation window
  await expect(page.locator('.slide-stage [data-slide-index="2"]').first()).toBeVisible();

  // Drawing: D enters (canvas + palette), D exits
  await popup.keyboard.press('d');
  await expect(popup.locator('canvas')).toBeVisible();
  await expect(popup.getByText('Exit (D)')).toBeVisible();
  await popup.keyboard.press('d');
  await expect(popup.locator('canvas')).toBeHidden();

  // Editor no longer has an in-window present mode: no Stop button anywhere
  await expect(page.getByRole('button', { name: /^stop$/i })).toHaveCount(0);
});
