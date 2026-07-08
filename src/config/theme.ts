import type { CSSProperties } from 'react';
import { DEFAULT_THEME } from './defaults';
import type { ExplorerTheme } from './types';

/** Merges a partial theme over the defaults and converts it to `--tse-*` CSS custom
 * properties. Host sites can alternatively set these vars directly on an ancestor and
 * pass no `theme` prop at all. */
export function themeToCssVars(theme?: ExplorerTheme): CSSProperties {
  const merged = { ...DEFAULT_THEME, ...theme };
  return {
    '--tse-accent': merged.accent,
    '--tse-accent-text': merged.accentText,
    '--tse-surface': merged.surface,
    '--tse-surface-text': merged.surfaceText,
    '--tse-font-family': merged.fontFamily,
    '--tse-radius': merged.radius,
    '--tse-overlay-scrim': merged.overlayScrim,
  } as CSSProperties;
}
