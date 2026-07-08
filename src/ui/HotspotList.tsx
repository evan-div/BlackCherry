import type { Hotspot } from '../config/types';
import { useExplorerStore } from '../state/store';

interface HotspotListProps {
  hotspots: Hotspot[];
}

/** "Featured areas" quick nav — clicking a chip selects the hotspot and flies the
 * camera to a framed view of it. Hidden in walk mode, where the camera isn't under
 * orbit control. */
export function HotspotList({ hotspots }: HotspotListProps) {
  const activeId = useExplorerStore((s) => s.activeHotspotId);
  const mode = useExplorerStore((s) => s.mode);
  const selectHotspot = useExplorerStore((s) => s.selectHotspot);
  const requestFlyToHotspot = useExplorerStore((s) => s.requestFlyToHotspot);
  const activate = useExplorerStore((s) => s.activate);

  if (mode !== 'explore' || hotspots.length === 0) return null;

  return (
    <div className="tse-hotspot-list" role="list" aria-label="Featured areas">
      {hotspots.map((hotspot) => (
        <button
          key={hotspot.id}
          type="button"
          role="listitem"
          className={`tse-btn tse-hotspot-chip${activeId === hotspot.id ? ' tse-btn--accent' : ''}`}
          onClick={() => {
            activate();
            selectHotspot(hotspot.id);
            requestFlyToHotspot(hotspot.id);
          }}
        >
          {hotspot.title}
        </button>
      ))}
    </div>
  );
}
