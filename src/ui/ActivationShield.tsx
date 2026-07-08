import { useExplorerStore } from '../state/store';
import { useIsTouchOnly } from '../hooks/useIsTouchOnly';

/**
 * Google-Maps-embed-style "click/tap to activate" gate. While inactive, the shield
 * sits over the canvas with no wheel/drag handling of its own (`touch-action: pan-y`
 * lets vertical page scroll pass straight through), so an explorer embedded mid-page
 * never hijacks the host page's scroll. Once activated, OrbitControls/WalkRig take
 * over and the shield unmounts.
 */
export function ActivationShield() {
  const activated = useExplorerStore((s) => s.activated);
  const activate = useExplorerStore((s) => s.activate);
  const isTouchOnly = useIsTouchOnly();

  if (activated) return null;

  return (
    <button type="button" className="tse-activation-shield" onClick={activate}>
      <span className="tse-activation-badge">
        {isTouchOnly ? 'Tap to explore' : 'Click and drag to explore'}
      </span>
    </button>
  );
}
