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
  const isWalking = useExplorerStore((s) => s.mode === 'walk');

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
      // In walk mode the marker is purely a visual indicator (still shown/
      // highlighted via the look-at logic in Hotspots.tsx) — pointer-events is
      // disabled on drei's own wrapper div (not just our button) so this DOM node,
      // which floats on top of the canvas, can never swallow the pointerdown
      // WalkRig needs for click-and-drag looking. A button alone isn't enough:
      // the wrapper auto-sizes to fit it and still intercepts hits at those pixels
      // even once the button itself stops responding. Interaction while walking
      // goes through "look at it, press E" instead, since pointer lock hides/
      // freezes the cursor anyway.
      wrapperClass={isWalking ? 'tse-marker-wrapper-walk' : undefined}
    >
      <button
        type="button"
        className={`tse-hotspot-marker${isActive ? ' tse-hotspot-marker--active' : ''}`}
        aria-label={hotspot.title}
        aria-expanded={isActive}
        aria-hidden={isWalking}
        tabIndex={isWalking ? -1 : 0}
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
