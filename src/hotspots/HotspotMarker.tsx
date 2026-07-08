import { Html } from '@react-three/drei';
import type { Vector3 } from 'three';
import type { Hotspot } from '../config/types';
import { useExplorerStore } from '../state/store';

interface HotspotMarkerProps {
  hotspot: Hotspot;
  position: Vector3;
}

export function HotspotMarker({ hotspot, position }: HotspotMarkerProps) {
  const isActive = useExplorerStore((s) => s.activeHotspotId === hotspot.id);
  const isHovered = useExplorerStore((s) => s.hoveredHotspotId === hotspot.id);
  const selectHotspot = useExplorerStore((s) => s.selectHotspot);
  const hoverHotspot = useExplorerStore((s) => s.hoveredHotspotId);
  const setHover = useExplorerStore((s) => s.hoverHotspot);

  return (
    <Html
      position={position}
      center
      transform={false}
      // "blending" is drei's built-in occlusion mode: it fades the marker via a cheap
      // GPU depth comparison rather than a hand-rolled per-frame raycast batch —
      // functionally the same "fade when hidden behind geometry" UX the plan called
      // for, with no extra code to maintain.
      occlude="blending"
      zIndexRange={[10, 0]}
    >
      <button
        type="button"
        className={`tse-hotspot-marker${isActive ? ' tse-hotspot-marker--active' : ''}`}
        aria-label={hotspot.title}
        aria-expanded={isActive}
        onClick={(e) => {
          e.stopPropagation();
          selectHotspot(isActive ? null : hotspot.id);
        }}
        onPointerOver={() => setHover(hotspot.id)}
        onPointerOut={() => {
          if (hoverHotspot === hotspot.id) setHover(null);
        }}
      />
      {isHovered && !isActive && (
        <div className="tse-hotspot-tooltip">{hotspot.title}</div>
      )}
    </Html>
  );
}
