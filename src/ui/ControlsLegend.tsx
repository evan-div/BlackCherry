import { useExplorerStore } from '../state/store';
import { useIsTouchOnly } from '../hooks/useIsTouchOnly';

export function ControlsLegend() {
  const activated = useExplorerStore((s) => s.activated);
  const mode = useExplorerStore((s) => s.mode);
  const isTouchOnly = useIsTouchOnly();

  if (!activated || mode !== 'explore') return null;

  return (
    <div className="tse-legend">
      {isTouchOnly
        ? 'Drag to rotate · Pinch to zoom · Two fingers to pan'
        : 'Left-drag to rotate · Right-drag to pan · Scroll to zoom'}
    </div>
  );
}
