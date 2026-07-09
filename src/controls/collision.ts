import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import type { Object3D } from 'three';
import type { WalkDefaults } from '../config/types';

const _origin = new Vector3();
const _down = new Vector3(0, -1, 0);
const raycaster = new Raycaster();
raycaster.far = 100;
const _box = new Box3();

export interface CollisionWorld {
  groundHeightAt: (x: number, z: number, fallback: number) => number;
  /** Clamps to the venue bounds AND pushes out of any known obstacle footprints
   * (tables, curtains) so the player can't walk into or stand on top of them. */
  resolveXZ: (x: number, z: number, radius: number) => [number, number];
}

interface ObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Name patterns identifying "furniture/wall-like" objects in the current
 * trade-show.glb export — there's no authored `COLLISION_*` proxy mesh (see
 * README's Blender export checklist for the naming contract a future export
 * should follow instead), so this is a best-effort stand-in built from the
 * asset's actual naming: round/rectangular tables and the curtain backdrop
 * panels that function as interior walls.
 */
const OBSTACLE_NAME_PATTERN = /table|curtain|counter/i;

/** Reasonable floor height to snap to if a raycast lands somewhere implausible
 * (e.g. a lower mezzanine level) — most of this venue's walkable floor sits near y=0. */
const REFERENCE_FLOOR_Y = 0;
const FLOOR_Y_TOLERANCE = 4;

function collectObstacles(root: Object3D): ObstacleBox[] {
  const obstacles: ObstacleBox[] = [];
  root.traverse((obj) => {
    if (!(obj instanceof Mesh) || !OBSTACLE_NAME_PATTERN.test(obj.name)) return;
    _box.setFromObject(obj);
    if (_box.isEmpty()) return;
    obstacles.push({ minX: _box.min.x, maxX: _box.max.x, minZ: _box.min.z, maxZ: _box.max.z });
  });
  return obstacles;
}

/** Pushes (x, z) out of a single obstacle box, expanded by `radius`, along the
 * shortest escape direction. Returns the input unchanged if not overlapping. */
function pushOutOfBox(x: number, z: number, radius: number, box: ObstacleBox): [number, number] {
  const closestX = Math.min(Math.max(x, box.minX), box.maxX);
  const closestZ = Math.min(Math.max(z, box.minZ), box.maxZ);
  const dx = x - closestX;
  const dz = z - closestZ;
  const distSq = dx * dx + dz * dz;
  if (distSq >= radius * radius) return [x, z];

  if (distSq < 1e-6) {
    // Center is inside the box (e.g. teleported/spawned there) — push out along
    // whichever axis has the smallest overlap rather than a degenerate zero vector.
    const overlapLeft = x - box.minX;
    const overlapRight = box.maxX - x;
    const overlapBottom = z - box.minZ;
    const overlapTop = box.maxZ - z;
    const minOverlap = Math.min(overlapLeft, overlapRight, overlapBottom, overlapTop);
    if (minOverlap === overlapLeft) return [box.minX - radius, z];
    if (minOverlap === overlapRight) return [box.maxX + radius, z];
    if (minOverlap === overlapBottom) return [x, box.minZ - radius];
    return [x, box.maxZ + radius];
  }

  const dist = Math.sqrt(distSq);
  const push = radius - dist;
  return [x + (dx / dist) * push, z + (dz / dist) * push];
}

/**
 * Lightweight collision for walk mode: obstacle boxes (see above) block horizontal
 * movement into tables/curtains, a hard XZ bounding-box clamp stands in for the
 * venue's outer walls, and a downward raycast finds ground height — clamped back to
 * a reference floor if it lands somewhere implausible (this venue has a lower
 * mezzanine level around one of its escalators, which a naive nearest-hit raycast
 * can otherwise snap the player down into). This is deliberately not a full
 * BVH/mesh-accurate system — see the README export checklist for the authored
 * `COLLISION_*` proxy that would replace it.
 */
export function createCollisionWorld(root: Object3D, walkDefaults: WalkDefaults): CollisionWorld {
  const bounds = walkDefaults.bounds;
  const obstacles = collectObstacles(root);

  return {
    groundHeightAt(x, z, fallback) {
      _origin.set(x, 50, z);
      raycaster.set(_origin, _down);
      const hits = raycaster.intersectObject(root, true);
      if (hits.length === 0) return fallback;
      const y = hits[0].point.y;
      return Math.abs(y - REFERENCE_FLOOR_Y) <= FLOOR_Y_TOLERANCE ? y : REFERENCE_FLOOR_Y;
    },
    resolveXZ(x, z, radius) {
      let px = x;
      let pz = z;
      for (const box of obstacles) {
        [px, pz] = pushOutOfBox(px, pz, radius, box);
      }
      return [
        Math.min(Math.max(px, bounds.min[0]), bounds.max[0]),
        Math.min(Math.max(pz, bounds.min[1]), bounds.max[1]),
      ];
    },
  };
}
