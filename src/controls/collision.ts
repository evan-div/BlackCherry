import { Raycaster, Vector3 } from 'three';
import type { Object3D } from 'three';
import { DEFAULT_WALK } from '../config/defaults';

const _origin = new Vector3();
const _down = new Vector3(0, -1, 0);
const raycaster = new Raycaster();
raycaster.far = 60;

export interface CollisionWorld {
  groundHeightAt: (x: number, z: number, fallback: number) => number;
  clampXZ: (x: number, z: number) => [number, number];
}

/**
 * Lightweight collision for walk mode: a downward raycast against the scene for
 * ground height, plus a hard XZ bounding-box clamp standing in for walls. This is
 * deliberately not a full BVH/wall-slide system — the placeholder scene has no wall
 * geometry to collide with yet. Once the real GLB ships an authored `COLLISION_*`
 * proxy mesh, this is the place to raycast against it specifically (accelerated via
 * three-mesh-bvh, already a dependency) and add wall sliding — tracked in the
 * performance-pass task.
 */
export function createCollisionWorld(root: Object3D): CollisionWorld {
  const bounds = DEFAULT_WALK.bounds;

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
