import { useExplorerStore } from '../state/store';

/** On-screen controls legend + the explicit, always-visible way out of walk mode —
 * pointer lock captures the mouse, so a user must never feel stuck. */
export function WalkInstructions() {
  const mode = useExplorerStore((s) => s.mode);
  const transitioning = useExplorerStore((s) => s.transitioning);
  const pointerLockAvailable = useExplorerStore((s) => s.pointerLockAvailable);
  const requestModeChange = useExplorerStore((s) => s.requestModeChange);

  if (mode !== 'walk' || transitioning) return null;

  return (
    <div className="tse-walk-instructions">
      <span>
        WASD to move · {pointerLockAvailable ? 'click + move mouse to look' : 'drag to look'} · Shift to sprint
      </span>
      <button type="button" className="tse-btn" onClick={() => requestModeChange('explore')}>
        Exit walk mode (Esc)
      </button>
    </div>
  );
}
