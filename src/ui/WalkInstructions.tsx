import type { Hotspot } from '../config/types';
import { useExplorerStore } from '../state/store';

interface WalkInstructionsProps {
  hotspots: Hotspot[];
}

/** On-screen controls legend + the explicit, always-visible way out of walk mode —
 * pointer lock captures the mouse, so a user must never feel stuck. Also surfaces
 * the "Press E" prompt when a hotspot is centered in view (see Hotspots.tsx, which
 * repurposes hover state as "looked at" while walking — clicking markers directly
 * doesn't work under pointer lock since the cursor is hidden/frozen). */
export function WalkInstructions({ hotspots }: WalkInstructionsProps) {
  const mode = useExplorerStore((s) => s.mode);
  const transitioning = useExplorerStore((s) => s.transitioning);
  const pointerLockAvailable = useExplorerStore((s) => s.pointerLockAvailable);
  const requestModeChange = useExplorerStore((s) => s.requestModeChange);
  const hoveredHotspotId = useExplorerStore((s) => s.hoveredHotspotId);
  const activeHotspotId = useExplorerStore((s) => s.activeHotspotId);

  if (mode !== 'walk' || transitioning) return null;

  const lookedAt = hoveredHotspotId && hoveredHotspotId !== activeHotspotId
    ? hotspots.find((h) => h.id === hoveredHotspotId)
    : null;

  return (
    <div className="tse-walk-instructions">
      {lookedAt && <span className="tse-walk-prompt">Press E — {lookedAt.title}</span>}
      <span>
        WASD to move · click + drag to look{pointerLockAvailable ? ' (or just move once clicked)' : ''} · Shift to
        sprint
      </span>
      <button type="button" className="tse-btn" onClick={() => requestModeChange('explore')}>
        Exit walk mode (Esc)
      </button>
    </div>
  );
}
