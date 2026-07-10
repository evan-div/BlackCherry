import { useCallback, useEffect, useRef } from 'react';
import type { ExplorerAnalyticsEvent } from '../config/types';
import { useExplorerStore } from '../state/store';

/**
 * Watches the store for discrete interaction transitions (activation, mode
 * switches, hotspot open/close) and forwards them to the host page's
 * `onAnalyticsEvent`. Returns a stable `emit` for the interactions that aren't
 * store transitions (CTA clicks, tour start/stop) to report imperatively.
 *
 * The callback is kept in a ref so a host passing a fresh closure every render
 * doesn't re-run the effects — which would double-fire events.
 */
export function useAnalyticsEvents(
  onAnalyticsEvent?: (event: ExplorerAnalyticsEvent) => void,
): (event: ExplorerAnalyticsEvent) => void {
  const callbackRef = useRef(onAnalyticsEvent);
  useEffect(() => {
    callbackRef.current = onAnalyticsEvent;
  }, [onAnalyticsEvent]);

  const emit = useCallback((event: ExplorerAnalyticsEvent) => {
    callbackRef.current?.(event);
  }, []);

  const activated = useExplorerStore((s) => s.activated);
  const mode = useExplorerStore((s) => s.mode);
  const activeHotspotId = useExplorerStore((s) => s.activeHotspotId);

  const wasActivated = useRef(false);
  useEffect(() => {
    if (activated && !wasActivated.current) emit({ type: 'activated' });
    wasActivated.current = activated;
  }, [activated, emit]);

  // Initialized to the mount-time mode so the initial value never fires as a "change".
  const prevMode = useRef(mode);
  useEffect(() => {
    if (mode !== prevMode.current) {
      prevMode.current = mode;
      emit({ type: 'mode_changed', mode });
    }
  }, [mode, emit]);

  const prevHotspotId = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevHotspotId.current;
    if (activeHotspotId === prev) return;
    prevHotspotId.current = activeHotspotId;
    if (prev) emit({ type: 'hotspot_closed', hotspotId: prev });
    if (activeHotspotId) emit({ type: 'hotspot_opened', hotspotId: activeHotspotId });
  }, [activeHotspotId, emit]);

  return emit;
}
