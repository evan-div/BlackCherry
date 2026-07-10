import { useEffect, useRef } from 'react';
import type { Hotspot } from '../config/types';
import { useExplorerStore } from '../state/store';

interface MinimapProps {
  hotspots: Hotspot[];
  /** Walkable XZ extent — the same bounds walk-mode movement is clamped to. */
  bounds: { min: [number, number]; max: [number, number] };
}

/** Config-declared XZ for a hotspot, if it has one (position anchors, or node
 * anchors carrying a fallback). Node-only anchors resolve inside the Canvas where
 * this DOM overlay can't see; a dot that's missing until the config gains a
 * fallback position is fine for a wayfinding aid. */
function hotspotXZ(hotspot: Hotspot): [number, number] | null {
  const anchor = hotspot.anchor;
  if (anchor.type === 'position') return [anchor.position[0], anchor.position[2]];
  if (anchor.fallbackPosition) return [anchor.fallbackPosition[0], anchor.fallbackPosition[2]];
  return null;
}

/**
 * Walk-mode "you are here" map: the venue footprint as a flat rectangle, hotspot
 * dots, and a heading arrow for the player. The arrow is positioned by this
 * component's own rAF loop reading the store's mutable walkPose (written by
 * WalkRig each rendered frame) — going through React state would re-render at
 * frame rate, and going through the R3F loop would stall the arrow whenever the
 * demand-driven canvas has no reason to draw.
 */
export function Minimap({ hotspots, bounds }: MinimapProps) {
  const mode = useExplorerStore((s) => s.mode);
  const transitioning = useExplorerStore((s) => s.transitioning);
  const walkPose = useExplorerStore((s) => s.walkPose);
  const playerRef = useRef<HTMLDivElement>(null);

  const [minX, minZ] = bounds.min;
  const [maxX, maxZ] = bounds.max;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const visible = mode === 'walk' && !transitioning;

  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const el = playerRef.current;
      if (!el || !walkPose.hasPose) return;
      const u = ((walkPose.x - minX) / spanX) * 100;
      const v = ((walkPose.z - minZ) / spanZ) * 100;
      // Camera yaw 0 faces -Z; with -Z as map-up, the arrow's clockwise CSS
      // rotation is simply the negated yaw.
      el.style.left = `${Math.min(Math.max(u, 0), 100)}%`;
      el.style.top = `${Math.min(Math.max(v, 0), 100)}%`;
      el.style.transform = `translate(-50%, -50%) rotate(${-walkPose.yaw}rad)`;
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [visible, walkPose, minX, minZ, spanX, spanZ]);

  if (!visible) return null;

  return (
    <div className="tse-minimap" aria-hidden="true">
      {hotspots.map((hotspot) => {
        const xz = hotspotXZ(hotspot);
        if (!xz) return null;
        const u = ((xz[0] - minX) / spanX) * 100;
        const v = ((xz[1] - minZ) / spanZ) * 100;
        if (u < 0 || u > 100 || v < 0 || v > 100) return null;
        return (
          <div
            key={hotspot.id}
            className="tse-minimap__hotspot"
            style={{ left: `${u}%`, top: `${v}%` }}
          />
        );
      })}
      <div ref={playerRef} className="tse-minimap__player" />
    </div>
  );
}
