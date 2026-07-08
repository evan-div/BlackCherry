import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Hotspot } from '../config/types';

/**
 * Resolves each hotspot's anchor to a world-space position. `ready` should flip to
 * true only once the scene subtree (placeholder or real GLTF) has actually mounted —
 * resolving too early would silently miss node-name anchors that don't exist yet.
 * Unresolvable node names are logged in dev so the Blender/hotspot-config naming
 * contract has a fast feedback loop.
 */
export function useHotspotAnchors(hotspots: Hotspot[], ready: boolean): Map<string, Vector3> {
  const scene = useThree((s) => s.scene);
  const [anchors, setAnchors] = useState<Map<string, Vector3>>(new Map());

  useEffect(() => {
    if (!ready) return;

    const map = new Map<string, Vector3>();
    const missing: string[] = [];

    for (const hotspot of hotspots) {
      if (hotspot.anchor.type === 'position') {
        map.set(hotspot.id, new Vector3(...hotspot.anchor.position));
        continue;
      }
      const node = scene.getObjectByName(hotspot.anchor.nodeName);
      if (!node) {
        missing.push(hotspot.anchor.nodeName);
        continue;
      }
      const pos = new Vector3();
      node.getWorldPosition(pos);
      if (hotspot.anchor.offset) {
        pos.add(new Vector3(...hotspot.anchor.offset));
      }
      map.set(hotspot.id, pos);
    }

    if (missing.length && import.meta.env.DEV) {
      console.warn(
        `[TradeShowExplorer] Could not resolve hotspot anchor node(s): ${missing.join(', ')}. ` +
          'Check that the hotspot config node names match Empties authored in the GLB.',
      );
    }

    setAnchors(map);
  }, [hotspots, ready, scene]);

  return anchors;
}
