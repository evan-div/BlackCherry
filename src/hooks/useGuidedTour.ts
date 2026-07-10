import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { ExplorerAnalyticsEvent, Hotspot } from '../config/types';
import { useExplorerStore } from '../state/store';

/** Per-stop dwell: covers the ~2s camera flight plus enough time to read the card. */
const TOUR_DWELL_MS = 6500;

/**
 * Guided tour: auto-drives explore mode through every hotspot in config order —
 * fly to it, open its card, dwell, move on — then returns to the default view.
 * Any real user input (pointer, wheel, key, or anything that deactivates the
 * widget) cancels it instantly: the moment someone wants to drive, the tour
 * hands over the wheel. That cancellation matters more than the sequencing —
 * a marketing page's passive visitors get a demo, but it must never fight an
 * active visitor for the camera (OrbitRig's fly-to cancel-on-drag handles the
 * camera side; this handles the timers).
 */
export function useGuidedTour(
  rootRef: RefObject<HTMLElement | null>,
  hotspots: Hotspot[],
  emitAnalytics: (event: ExplorerAnalyticsEvent) => void,
) {
  const tourActive = useExplorerStore((s) => s.tourActive);
  const setTourActive = useExplorerStore((s) => s.setTourActive);
  const activate = useExplorerStore((s) => s.activate);
  const activated = useExplorerStore((s) => s.activated);
  const selectHotspot = useExplorerStore((s) => s.selectHotspot);
  const requestFlyToHotspot = useExplorerStore((s) => s.requestFlyToHotspot);
  const requestReset = useExplorerStore((s) => s.requestReset);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tourActiveRef = useRef(tourActive);
  tourActiveRef.current = tourActive;
  const hotspotsRef = useRef(hotspots);
  hotspotsRef.current = hotspots;

  const stopTour = useCallback(
    (reason: 'completed' | 'user_input' | 'stopped') => {
      if (!tourActiveRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setTourActive(false);
      emitAnalytics({ type: 'tour_ended', reason });
    },
    [setTourActive, emitAnalytics],
  );

  const startTour = useCallback(() => {
    if (tourActiveRef.current || hotspotsRef.current.length === 0) return;
    activate();
    setTourActive(true);
    emitAnalytics({ type: 'tour_started' });

    let index = 0;
    const step = () => {
      const stops = hotspotsRef.current;
      if (index >= stops.length) {
        // Final beat: close the card, ease home, done.
        selectHotspot(null);
        requestReset();
        stopTour('completed');
        return;
      }
      const hotspot = stops[index];
      index += 1;
      selectHotspot(hotspot.id);
      requestFlyToHotspot(hotspot.id);
      timerRef.current = setTimeout(step, TOUR_DWELL_MS);
    };
    step();
  }, [activate, setTourActive, emitAnalytics, selectHotspot, requestFlyToHotspot, requestReset, stopTour]);

  // Hand over the wheel on any real input inside the widget. Capture phase so a
  // pointerdown the canvas swallows still cancels the timers. The tour's own
  // stop button is exempt — its click handler reports reason 'stopped' itself.
  useEffect(() => {
    if (!tourActive) return;
    const root = rootRef.current;
    if (!root) return;
    const cancel = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest?.('.tse-tour-button')) return;
      stopTour('user_input');
    };
    root.addEventListener('pointerdown', cancel, true);
    root.addEventListener('wheel', cancel, true);
    root.addEventListener('keydown', cancel, true);
    return () => {
      root.removeEventListener('pointerdown', cancel, true);
      root.removeEventListener('wheel', cancel, true);
      root.removeEventListener('keydown', cancel, true);
    };
  }, [tourActive, rootRef, stopTour]);

  // Deactivation (Escape, click outside) fires at the document level where the
  // listeners above can't see it — treat it as user input too.
  useEffect(() => {
    if (!activated) stopTour('user_input');
  }, [activated, stopTour]);

  // Unmount safety: never leave a timer driving a dead component tree.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { tourActive, startTour, stopTour };
}
