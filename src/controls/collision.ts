import { BufferGeometry, Mesh, Raycaster, Vector3 } from 'three';
import type { Object3D } from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import type { WalkDefaults } from '../config/types';

// three-mesh-bvh's one-time global patch: accelerates Raycaster.intersectObject from
// brute-force-per-triangle to a bounds-tree search. Safe to apply unconditionally —
// geometries without a computed bounds tree just fall back to the default behavior.
// @ts-expect-error three-mesh-bvh's types don't perfectly match three's, this is the documented pattern
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast;

const _origin = new Vector3();
const _down = new Vector3(0, -1, 0);
const _dir = new Vector3();
const groundRaycaster = new Raycaster();
groundRaycaster.far = 100;
const wallRaycaster = new Raycaster();

/** Reasonable floor height to snap to if a raycast lands somewhere implausible
 * (e.g. a lower mezzanine level) — most of this venue's walkable floor sits near y=0. */
const REFERENCE_FLOOR_Y = 0;
const FLOOR_Y_TOLERANCE = 4;

/** How far above the reference floor a ground hit can be and still count as "the
 * floor" rather than "the top of a table/counter" — small enough to allow gentle
 * ramps, too small for actual furniture height. */
const FURNITURE_CLEARANCE = 0.35;

/** Compass offsets (as unit direction, radius multiplied in) tried, at growing
 * radii, to find real floor near a point that turned out to be standing on
 * furniture — e.g. the orbit camera happened to be hovering over a table when the
 * user hit "Walk". */
const SEARCH_DIRECTIONS: Array<[number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const SEARCH_RADII = [1, 2, 3, 5, 8];

/** Heights (relative to eye height) a horizontal probe ray is cast at — low enough to
 * catch a table's draped cloth or a low counter, high enough to still catch a
 * chest-height obstacle. Two heights stand in for the "3 rays" a full capsule-cast
 * would use, without needing one. */
const PROBE_HEIGHT_OFFSETS = [-1.2, -0.6];

let bvhBuilt = false;

function ensureBvh(root: Object3D) {
  if (bvhBuilt) return;
  bvhBuilt = true;
  root.traverse((obj) => {
    if (obj instanceof Mesh && obj.geometry) {
      try {
        obj.geometry.computeBoundsTree();
      } catch {
        // Non-indexed or otherwise incompatible geometry — raycasting against it
        // just falls back to the (slower) default triangle-by-triangle test.
      }
    }
  });
}

/** Authored collision proxies per the Blender export contract (README): every mesh
 * named `COLLISION*` forms a simplified floor+walls set that walk mode should test
 * against INSTEAD of the full render geometry — both cheaper (a few thousand
 * triangles vs. the whole hall) and more intentional (authors decide exactly what
 * blocks movement). TradeShowModel hides these from render; three's Raycaster
 * ignores visibility, so they stay hittable. */
function collectCollisionProxies(root: Object3D): Mesh[] {
  const proxies: Mesh[] = [];
  root.traverse((obj) => {
    if (obj instanceof Mesh && obj.name.startsWith('COLLISION')) {
      proxies.push(obj);
    }
  });
  return proxies;
}

export interface CollisionWorld {
  groundHeightAt: (x: number, z: number, fallback: number) => number;
  /**
   * Resolves a desired move from (fromX, fromZ) to (toX, toZ): blocked by real
   * geometry (tables, curtains, counters — whatever's actually there, tested via
   * horizontal raycasts rather than name-matching, see below) slides along
   * whichever axis isn't blocked, then clamps to the venue's outer bounds.
   */
  resolveMove: (fromX: number, fromZ: number, toX: number, toZ: number, eyeY: number, radius: number) => [number, number];
  /**
   * Finds a walk-mode spawn point near (x, z): if directly above real floor,
   * uses it as-is; if it turns out to be hovering over furniture (the orbit
   * camera was above a table when the user hit "Walk"), searches outward in a
   * compass ring for the nearest point that's actually on the floor.
   */
  findSpawnPoint: (x: number, z: number) => [number, number, number];
}

/**
 * Lightweight collision for walk mode: horizontal raycasts (at a couple of probe
 * heights) against the actual rendered geometry block movement, and a downward
 * raycast finds ground height — clamped back to a reference floor if it lands
 * somewhere implausible (this venue has a lower mezzanine level near one of its
 * escalators, which a naive nearest-hit raycast can otherwise snap the player into).
 *
 * Earlier this matched obstacles by mesh NAME (tables/curtains/counters) with an
 * axis-aligned bounding box per match. That broke badly once the model went through
 * gltf-transform's `join` optimization step: dozens of scattered tables/curtains got
 * merged into a handful of meshes, and the bounding box of a mesh whose triangles
 * are scattered across a third of the room is a box covering a third of the room —
 * producing both false "walls" over open floor and missed obstacles (whatever the
 * counter got merged into didn't happen to keep a matching name). Raycasting against
 * the real geometry doesn't care what anything is named or how it got merged.
 *
 * Not a full BVH/capsule-cast physics system — see the README export checklist for
 * the authored `COLLISION_*` proxy that would eventually replace this.
 */
export function createCollisionWorld(root: Object3D, walkDefaults: WalkDefaults): CollisionWorld {
  const bounds = walkDefaults.bounds;
  ensureBvh(root);
  // With authored proxies, both wall and ground tests run against just those
  // meshes (the contract says the proxy set includes the floor). Without them,
  // fall back to raycasting the full render geometry.
  const proxies = collectCollisionProxies(root);
  const castTargets: Object3D[] = proxies.length > 0 ? proxies : [root];

  function isBlocked(fromX: number, fromZ: number, toX: number, toZ: number, eyeY: number, radius: number): boolean {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-6) return false;
    _dir.set(dx / dist, 0, dz / dist);
    const probeDist = dist + radius;

    for (const offset of PROBE_HEIGHT_OFFSETS) {
      _origin.set(fromX, eyeY + offset, fromZ);
      wallRaycaster.set(_origin, _dir);
      wallRaycaster.far = probeDist;
      if (wallRaycaster.intersectObjects(castTargets, true).length > 0) return true;
    }
    return false;
  }

  function clampBounds(x: number, z: number): [number, number] {
    return [
      Math.min(Math.max(x, bounds.min[0]), bounds.max[0]),
      Math.min(Math.max(z, bounds.min[1]), bounds.max[1]),
    ];
  }

  function rawGroundHeightAt(x: number, z: number): number | null {
    _origin.set(x, 50, z);
    groundRaycaster.set(_origin, _down);
    const hits = groundRaycaster.intersectObjects(castTargets, true);
    return hits.length === 0 ? null : hits[0].point.y;
  }

  function groundHeightAt(x: number, z: number, fallback: number): number {
    const y = rawGroundHeightAt(x, z);
    if (y === null) return fallback;
    return Math.abs(y - REFERENCE_FLOOR_Y) <= FLOOR_Y_TOLERANCE ? y : REFERENCE_FLOOR_Y;
  }

  return {
    groundHeightAt,
    findSpawnPoint(x, z) {
      const [cx, cz] = clampBounds(x, z);
      const y0 = rawGroundHeightAt(cx, cz);
      if (y0 !== null && Math.abs(y0 - REFERENCE_FLOOR_Y) <= FURNITURE_CLEARANCE) {
        return [cx, cz, y0];
      }
      for (const radius of SEARCH_RADII) {
        for (const [dx, dz] of SEARCH_DIRECTIONS) {
          const [sx, sz] = clampBounds(cx + dx * radius, cz + dz * radius);
          const y = rawGroundHeightAt(sx, sz);
          if (y !== null && Math.abs(y - REFERENCE_FLOOR_Y) <= FURNITURE_CLEARANCE) {
            return [sx, sz, y];
          }
        }
      }
      // Nothing at true floor level found nearby — fall back to the reference
      // floor at the original point rather than searching forever.
      return [cx, cz, REFERENCE_FLOOR_Y];
    },
    resolveMove(fromX, fromZ, toX, toZ, eyeY, radius) {
      if (!isBlocked(fromX, fromZ, toX, toZ, eyeY, radius)) {
        return clampBounds(toX, toZ);
      }
      // Slide: try the X-only and Z-only components independently so brushing past
      // a wall at an angle doesn't just stop movement dead.
      if (!isBlocked(fromX, fromZ, toX, fromZ, eyeY, radius)) {
        return clampBounds(toX, fromZ);
      }
      if (!isBlocked(fromX, fromZ, fromX, toZ, eyeY, radius)) {
        return clampBounds(fromX, toZ);
      }
      return clampBounds(fromX, fromZ);
    },
  };
}
