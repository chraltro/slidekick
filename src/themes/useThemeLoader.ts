import { useEffect } from 'react';

/**
 * All theme CSS files are bundled eagerly so theme switching is instant —
 * we just toggle the `.theme-<id>` class on the slide canvas root via
 * RenderSlide's className. This hook additionally injects optional user
 * customCss into a single <style id="user-custom-css"> tag.
 */
import.meta.glob('./*.css', { eager: true });

export function useThemeLoader(_themeId: string, customCss?: string) {
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
