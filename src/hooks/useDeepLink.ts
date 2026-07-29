import { useEffect, useRef } from 'react';
import type { Hotspot } from '../config/types';
import { useExplorerStore } from '../state/store';

/** What a shareable URL asked the explorer to open on load. */
export interface DeepLinkIntent {
  mode?: 'walk';
  hotspotId?: string;
}

const HOTSPOT_PARAM = 'tse_hotspot';
const MODE_PARAM = 'tse_mode';

/** Reads the deep-link intent out of the current page URL, or null if none is
 * present. Called once, synchronously, at mount — before any state that the sync
 * effect would otherwise write back over the incoming params. */
export function readDeepLinkIntent(): DeepLinkIntent | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get(MODE_PARAM);
  const hotspotId = params.get(HOTSPOT_PARAM);
  if (mode !== 'walk' && !hotspotId) return null;
  return { mode: mode === 'walk' ? 'walk' : undefined, hotspotId: hotspotId ?? undefined };
}

/**
 * Two-way binding between the page URL and the explorer, gated on `enabled`:
 *  - applies the incoming `intent` once the scene is ready (auto-activates, opens
 *    the requested hotspot, and — in explore mode — flies to it),
 *  - then mirrors mode/active-hotspot changes back into the URL via replaceState,
 *    so the address bar always reflects the current view and can be copied/shared.
 *
 * The initial mode itself is applied at store creation (see TradeShowExplorer), so
 * this hook only needs to handle activation, hotspot selection, and URL writing.
 */
export function useDeepLink(enabled: boolean, intent: DeepLinkIntent | null, hotspots: Hotspot[]): void {
  const activate = useExplorerStore((s) => s.activate);
  const selectHotspot = useExplorerStore((s) => s.selectHotspot);
  const requestFlyToHotspot = useExplorerStore((s) => s.requestFlyToHotspot);
  const loadingActive = useExplorerStore((s) => s.loading.active);
  const mode = useExplorerStore((s) => s.mode);
  const activeHotspotId = useExplorerStore((s) => s.activeHotspotId);

  // Apply the incoming intent exactly once, after the scene has finished loading —
  // selecting a hotspot before its anchor resolves would leave the fly-to a no-op.
  const appliedRef = useRef(false);
  useEffect(() => {
    if (!enabled || appliedRef.current) return;
    if (!intent) {
      appliedRef.current = true;
      return;
    }
    if (loadingActive) return;
    appliedRef.current = true;

    activate();
    const hotspotId = intent.hotspotId;
    if (hotspotId && hotspots.some((h) => h.id === hotspotId)) {
      selectHotspot(hotspotId);
      // Fly to it in explore mode; walk mode places the player at its own spawn,
      // and the fixed card is enough there.
      if (mode !== 'walk') {
        // Anchors resolve in an effect right after the scene reports ready — a short
        // beat guarantees they're in place before the fly-to command is dispatched.
        window.setTimeout(() => requestFlyToHotspot(hotspotId), 350);
      }
    }
  }, [enabled, intent, hotspots, loadingActive, mode, activate, selectHotspot, requestFlyToHotspot]);

  // Mirror the current view into the URL. Guarded on appliedRef so it never runs
  // before the incoming intent has been consumed (which would wipe the params
  // out of the URL before they're read).
  useEffect(() => {
    if (!enabled || !appliedRef.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (activeHotspotId) params.set(HOTSPOT_PARAM, activeHotspotId);
    else params.delete(HOTSPOT_PARAM);
    if (mode === 'walk') params.set(MODE_PARAM, 'walk');
    else params.delete(MODE_PARAM);
    const qs = params.toString();
    const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
    window.history.replaceState(window.history.state, '', url);
  }, [enabled, activeHotspotId, mode]);
}
