import { useExplorerStore } from '../state/store';

interface TourButtonProps {
  active: boolean;
  onStart: () => void;
  onStop: () => void;
}

/** Starts/stops the guided tour (explore mode only — walk mode owns the camera).
 * The class name doubles as useGuidedTour's exemption marker so clicking "Stop
 * tour" doesn't first get swallowed by the tour's own cancel-on-input listener. */
export function TourButton({ active, onStart, onStop }: TourButtonProps) {
  const mode = useExplorerStore((s) => s.mode);
  const hasError = useExplorerStore((s) => !!s.error);

  if (mode !== 'explore' || hasError) return null;

  return (
    <button
      type="button"
      className={`tse-btn tse-tour-button${active ? ' tse-btn--accent' : ''}`}
      onClick={active ? onStop : onStart}
    >
      {active ? 'Stop tour' : 'Take the tour'}
    </button>
  );
}
