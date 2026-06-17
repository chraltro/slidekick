import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * End-to-end coverage for user-authored themes: create in-app, apply, persist
 * across reload, export the deck (custom theme CSS must be inlined), and export
 * the theme file itself.
 */

async function openPicker(page: Page) {
  const createCard = page.getByRole('button', { name: /create new theme/i });
  if (await createCard.isVisible().catch(() => false)) return;
  await page.getByTestId('theme-picker-trigger').click();
  await expect(createCard).toBeVisible();
}

test.describe('custom themes', () => {
  test('create, apply, persist, and export a custom theme', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();
    await expect(page.locator('.slide-canvas').first()).toBeVisible();

    // Open the theme editor via the picker's "Create theme" card.
    await openPicker(page);
    await page.getByRole('button', { name: /create new theme/i }).click();

    // The editor modal is up.
    await expect(page.getByTestId('theme-editor')).toBeVisible();

    // Name it and set a distinctive background via the hex text input next to --bg.
    const nameInput = page.getByPlaceholder('Theme name');
    await nameInput.fill('Acid Test');

    // Find the --bg row's text field (the monospace input) and set a unique colour.
    const bgRow = page.locator('div', { hasText: /^Background$/ }).first();
    // The background hex input is the first monospace text input in the controls.
    const bgHex = page.locator('input.font-mono').first();
    await bgHex.fill('#0a2540');

    // Save the theme (button label flips to "Saved" briefly).
    const saveBtn = page.getByRole('button', { name: /save theme/i });
    await saveBtn.click();

    // Close the editor.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('theme-editor')).toBeHidden();

    // The deck's frontmatter theme should now be the custom id, and the slide
    // canvas should carry the theme-custom-* class with the new background.
    await expect(page.locator('.slide-canvas').first()).toHaveClass(/theme-custom-acid-test/);
    await expect
      .poll(() => page.locator('.slide-canvas').first().evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe('rgb(10, 37, 64)'); // #0a2540

    // Frontmatter in the editor should reference the custom theme.
    const docHasTheme = await page.evaluate(() => {
      const v = (window as unknown as { __cmView?: any }).__cmView;
      return v.state.doc.toString().includes('theme: custom-acid-test');
    });
    expect(docHasTheme).toBe(true);

    // --- Persistence across reload ---
    // Autosave clears the "Unsaved" flag once the deck (with its custom-theme
    // frontmatter) has been written to IndexedDB. Wait for that, then reload.
    await expect(page.getByText('Unsaved')).toBeHidden({ timeout: 5000 });
    await page.reload();
    await expect(page.locator('.slide-canvas').first()).toBeVisible();
    // Custom theme CSS injects after IndexedDB resolves; poll for the colour.
    await expect
      .poll(
        () => page.locator('.slide-canvas').first().evaluate((el) => getComputedStyle(el).backgroundColor),
        { timeout: 5000 },
      )
      .toBe('rgb(10, 37, 64)');

    // The custom theme appears in the picker after reload.
    await openPicker(page);
    await expect(page.locator('[data-theme-id="custom-acid-test"]')).toBeVisible();
    await page.keyboard.press('Escape');

    // --- Deck export inlines the custom theme CSS ---
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /^export$/i }).click();
    await page.getByRole('button', { name: /HTML \(self-contained\)/i }).click();
    const html = readFileSync(await (await downloadPromise).path(), 'utf-8');
    expect(html).toContain('.theme-custom-acid-test');
    expect(html).toContain('#0a2540');
  });

  test('upload a theme file and apply it', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');
    await expect(page.locator('.cm-editor')).toBeVisible();

    await openPicker(page);
    await page.getByRole('button', { name: /create new theme/i }).click();
    await expect(page.getByTestId('theme-editor')).toBeVisible();

    const themeFile = JSON.stringify({
      format: 'md-presentations-theme',
      version: 1,
      theme: {
        id: 'custom-uploaded-neon',
        name: 'Uploaded Neon',
        category: 'dev-dark',
        shikiTheme: 'dracula',
        vars: { '--bg': '#120458', '--fg': '#f5f5ff', '--accent': '#39ff14' },
      },
    });

    // Set the hidden file input directly.
    await page.locator('input[type=file]').setInputFiles({
      name: 'uploaded-neon.mdtheme.json',
      mimeType: 'application/json',
      buffer: Buffer.from(themeFile),
    });

    // Name field should reflect the uploaded theme.
    await expect(page.getByPlaceholder('Theme name')).toHaveValue('Uploaded Neon');

    await page.getByRole('button', { name: /save theme/i }).click();
    await expect(page.getByText(/^Saved$/)).toBeVisible();
    await page.keyboard.press('Escape');

    await page.waitForTimeout(500);
    const bg = await page.locator('.slide-canvas').first().evaluate((el) =>
      getComputedStyle(el).backgroundColor,
    );
    expect(bg).toBe('rgb(18, 4, 88)'); // #120458
  });
});
