import { Raycaster, Vector3 } from 'three';
import type { Object3D } from 'three';
import type { WalkDefaults } from '../config/types';

const _origin = new Vector3();
const _down = new Vector3(0, -1, 0);
const raycaster = new Raycaster();
raycaster.far = 100;

export interface CollisionWorld {
  groundHeightAt: (x: number, z: number, fallback: number) => number;
  clampXZ: (x: number, z: number) => [number, number];
}

/**
 * Lightweight collision for walk mode: a downward raycast against the scene for
 * ground height, plus a hard XZ bounding-box clamp standing in for walls. This is
 * deliberately not a full BVH/wall-slide system — neither the placeholder scene nor
 * the current trade-show.glb export has an authored collision proxy to raycast
 * against. Should a future export ship a `COLLISION_*` mesh, this is the place to
 * raycast against it specifically (accelerated via three-mesh-bvh, already a
 * dependency) and add wall sliding.
 */
export function createCollisionWorld(root: Object3D, walkDefaults: WalkDefaults): CollisionWorld {
  const bounds = walkDefaults.bounds;

  return {
    groundHeightAt(x, z, fallback) {
      _origin.set(x, 50, z);
      raycaster.set(_origin, _down);
      const hits = raycaster.intersectObject(root, true);
      return hits.length > 0 ? hits[0].point.y : fallback;
    },
    clampXZ(x, z) {
      return [
        Math.min(Math.max(x, bounds.min[0]), bounds.max[0]),
        Math.min(Math.max(z, bounds.min[1]), bounds.max[1]),
      ];
    },
  };
}
