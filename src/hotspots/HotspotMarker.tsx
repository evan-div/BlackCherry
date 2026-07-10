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
  const currentHoverId = useExplorerStore((s) => s.hoveredHotspotId);
  const setHover = useExplorerStore((s) => s.hoverHotspot);
  const isWalking = useExplorerStore((s) => s.mode === 'walk');

  return (
    <Html
      position={position}
      center
      transform={false}
      // No `occlude` prop: drei's GPU depth-texture occlusion modes ("blending"/
      // "raycast") turned out unreliable — verified via screenshot that the ring
      // could render with effectively zero visible opacity despite every DOM/CSS
      // property (computed opacity, size, position) reporting normal values, an
      // occlusion-texture-specific failure invisible to those checks. A landmark
      // ring that's meant to always read as "there's something here" is better
      // served by always being visible than by a fade effect that can silently
      // break.
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
        className={[
          'tse-hotspot-marker',
          isActive && 'tse-hotspot-marker--active',
          isHovered && !isActive && 'tse-hotspot-marker--hovered',
        ]
          .filter(Boolean)
          .join(' ')}
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
          if (currentHoverId === hotspot.id) setHover(null);
        }}
      >
        <span>More Details</span>
      </button>
    </Html>
  );
}
