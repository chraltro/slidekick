import { test, expect } from '@playwright/test';
test('slide jumper: ARIA + search + jump', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/'); await page.locator('.cm-editor').waitFor(); await page.locator('.slide-canvas').first().waitFor();
  await page.waitForTimeout(500);
  await page.keyboard.press('Control+k');
  const dialog = page.locator('[role="dialog"][aria-label="Jump to slide"]');
  await expect(dialog).toBeVisible();
  const combo = dialog.locator('input[role="combobox"]');
  await expect(combo).toBeFocused();
  await expect(dialog.locator('[role="listbox"]')).toBeVisible();
  // Type a query and jump with the keyboard.
  await combo.fill('why');
  await page.waitForTimeout(200);
  const opts = dialog.locator('[role="option"]');
  expect(await opts.count()).toBeGreaterThan(0);
  await page.keyboard.press('ArrowDown');
  // active option should be reflected via aria-activedescendant
  const adesc = await combo.getAttribute('aria-activedescendant');
  expect(adesc).toContain('slidejumper-opt-');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
});
