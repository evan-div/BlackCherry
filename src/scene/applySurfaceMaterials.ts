import {
  Box3,
  BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Vector2,
  Vector3,
} from 'three';
import type { Object3D } from 'three';
import {
  CONCRETE_TILE_METERS,
  createConcreteTextures,
  createWallTexture,
} from './proceduralTextures';

/**
 * Upgrades the big flat surfaces of a loaded model — the floor and the wall/ceiling
 * shell — from their exported flat-gray materials to textured PBR (see
 * proceduralTextures.ts for the maps). The model itself carries no useful
 * surface detail, so this is where the venue gets its polished-concrete floor and
 * a neutral plaster shell.
 *
 * Meshes are classified by their WORLD-space bounding box, not by name — the same
 * lesson collision.ts learned: gltf-transform's `join` step merges/renames meshes,
 * so geometry (a huge, near-flat, ground-level footprint = floor; a huge, tall
 * footprint = shell) is the reliable signal. Furniture and booths fall well under
 * the footprint threshold and are left untouched.
 *
 * Runs once per scene object (idempotent via the WeakSet) so drei's cached-scene
 * reuse across error-retry remounts doesn't re-bake UVs or leak materials.
 */

const processed = new WeakSet<object>();

/** Minimum XZ footprint (m²) to be considered architecture rather than furniture. */
const ARCHITECTURE_FOOTPRINT = 2000;

const _box = new Box3();
const _size = new Vector3();
const _center = new Vector3();
const _v = new Vector3();

/** Replaces a mesh's UVs with a world-space planar projection (XZ → UV) at the
 * concrete tile scale, so the floor tiles cleanly and at a correct physical size
 * no matter what UVs — if any — the export shipped. RepeatWrapping on the textures
 * handles the resulting >1 coordinates. */
function bakePlanarFloorUV(mesh: Mesh): void {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  if (!position) return;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    _v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    uv[i * 2] = _v.x / CONCRETE_TILE_METERS;
    uv[i * 2 + 1] = _v.z / CONCRETE_TILE_METERS;
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
}

export function applySurfaceMaterials(scene: Object3D): void {
  if (processed.has(scene)) return;
  processed.add(scene);

  // World matrices must be current before we read world-space bounds / bake world UVs.
  scene.updateMatrixWorld(true);

  const floors: Mesh[] = [];
  const walls: Mesh[] = [];

  scene.traverse((obj) => {
    if (!(obj instanceof Mesh) || !obj.geometry) return;
    // Collision proxies are invisible-but-present; never re-skin them.
    if (obj.name.startsWith('COLLISION')) return;

    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    const bounds = obj.geometry.boundingBox;
    if (!bounds) return;
    _box.copy(bounds).applyMatrix4(obj.matrixWorld);
    _box.getSize(_size);
    _box.getCenter(_center);

    const footprint = _size.x * _size.z;
    if (footprint < ARCHITECTURE_FOOTPRINT) return;

    if (_size.y < 2.5 && _center.y < 4) {
      floors.push(obj);
    } else if (_size.y > 5) {
      walls.push(obj);
    }
  });

  if (floors.length > 0) {
    const concrete = createConcreteTextures();
    const floorMaterial = new MeshStandardMaterial({
      map: concrete.map,
      roughnessMap: concrete.roughnessMap,
      normalMap: concrete.normalMap,
      normalScale: new Vector2(0.35, 0.35),
      metalness: 0,
      // roughness multiplies the map; keep it at 1 so the map's 0.3–0.7 range wins.
      roughness: 1,
      // Polished concrete's whole appeal is that it picks up the room — lean on
      // the scene environment (the procedural IBL) for a soft reflected sheen.
      envMapIntensity: 0.75,
    });
    for (const mesh of floors) {
      bakePlanarFloorUV(mesh);
      mesh.material = floorMaterial;
      mesh.receiveShadow = true;
    }
  }

  if (walls.length > 0) {
    const wall = createWallTexture();
    const wallMaterial = new MeshStandardMaterial({
      map: wall.map,
      metalness: 0,
      roughness: 0.82,
      envMapIntensity: 0.3,
    });
    for (const mesh of walls) {
      mesh.material = wallMaterial;
    }
  }
}
