import { useEffect } from 'react';
import { useCustomThemes } from './useCustomThemes';

/**
 * All built-in theme CSS files are bundled eagerly so theme switching is
 * instant — we just toggle the `.theme-<id>` class on the slide canvas root via
 * RenderSlide's className. Custom (user) themes are injected at runtime by the
 * custom-theme registry; subscribing to it here keeps the `<style>` tag present
 * in whichever window uses this hook (editor + audience).
 *
 * This hook additionally injects optional per-deck customCss into a single
 * <style id="user-custom-css"> tag.
 */
import.meta.glob('./*.css', { eager: true });

export function useThemeLoader(_themeId: string, customCss?: string) {
  // Subscribe so custom themes load + inject their CSS in this window.
  useCustomThemes();

  useEffect(() => {
    const id = 'user-custom-css';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!customCss) {
      if (style) style.remove();
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = customCss;
  }, [customCss]);
}
