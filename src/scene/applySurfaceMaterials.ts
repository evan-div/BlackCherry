import {
  Box3,
  BufferAttribute,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector2,
  Vector3,
} from 'three';
import type { Object3D } from 'three';
import {
  CONCRETE_TILE_METERS,
  WALL_TILE_METERS,
  createConcreteTextures,
  createWallTexture,
} from './proceduralTextures';
import type { WebGLProgramParametersWithUniforms } from 'three';

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
/** Above this height a huge-footprint mesh isn't a wall/shell — it's a merged
 * mesh whose bounding box exploded during gltf-transform's `join` (e.g. all the
 * round tablecloths welded into one 80–230 m-tall "mesh"). The real shell is ~11 m. */
const MAX_SHELL_HEIGHT = 20;

/** This export's main-hall floor piece was authored ~0.6 m above the foyer floor
 * (and above its own furniture, which sits at ground level), so the two floor
 * pieces don't line up and the raised piece clips up through its tables. Floor
 * vertices whose world height falls in this band are snapped down to ground level
 * to reconcile them. The stage platform (~0.9 m, with the podium/screen actually
 * resting on it) sits above the band and is deliberately preserved. */
const FLOOR_STEP_BAND: [number, number] = [0.25, 0.8];
const GROUND_LEVEL_Y = 0;

/** The same two floor pieces also leave a ~0.2 m gap in Z where they meet — the
 * main-hall floor's front edge ends at z≈48.6 and the foyer floor's back edge
 * starts at z≈48.8, so once they're coplanar you see straight through the hole
 * between them. Vertices on the main-hall front edge (this Z band) are pushed
 * just past the foyer edge, so the two coplanar pieces overlap by a hair instead
 * of leaving a gap. World-planar UVs keep the concrete continuous across it. */
const FLOOR_SEAM_EDGE_Z: [number, number] = [48.4, 48.75];
const FLOOR_SEAM_TARGET_Z = 49;

const _box = new Box3();
const _size = new Vector3();
const _center = new Vector3();
const _v = new Vector3();
const _inv = new Matrix4();

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

/** Reconciles the two mis-authored floor pieces so they read as one continuous
 * floor: snaps the raised main-hall level down to ground (FLOOR_STEP_BAND → 0) so
 * it lines up with the foyer and stops clipping its own furniture, and closes the
 * ~0.2 m gap where the two pieces meet (FLOOR_SEAM_EDGE_Z → past the foyer edge).
 * Operates in world space then maps back through the inverse world matrix, so it's
 * correct regardless of the node's transform. Only Y and (at the seam) Z move; the
 * planar UVs baked from world XZ stay continuous. */
function reconcileFloorGeometry(mesh: Mesh): void {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  if (!position) return;
  _inv.copy(mesh.matrixWorld).invert();
  let moved = 0;
  for (let i = 0; i < position.count; i++) {
    _v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    let changed = false;
    if (_v.y > FLOOR_STEP_BAND[0] && _v.y < FLOOR_STEP_BAND[1]) {
      _v.y = GROUND_LEVEL_Y;
      changed = true;
    }
    if (_v.z > FLOOR_SEAM_EDGE_Z[0] && _v.z < FLOOR_SEAM_EDGE_Z[1]) {
      _v.z = FLOOR_SEAM_TARGET_Z;
      changed = true;
    }
    if (changed) {
      _v.applyMatrix4(_inv);
      position.setXYZ(i, _v.x, _v.y, _v.z);
      moved++;
    }
  }
  if (moved > 0) {
    position.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
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

    // Only the floor and the enclosing shell are re-skinned, both identified by a
    // large horizontal footprint. Freestanding meshes are deliberately left alone:
    // a shape-based "wall panel" rule was tried, but it also caught the elevator
    // bank and the registration counter (thin, tall, but not walls), re-skinning
    // things that were already correct — so texturing is kept to the shell only.
    const footprint = _size.x * _size.z;
    if (footprint < ARCHITECTURE_FOOTPRINT) return;

    if (_size.y < 2.5 && _center.y < 4) {
      floors.push(obj);
    } else if (_size.y > 5 && _size.y < MAX_SHELL_HEIGHT) {
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
      reconcileFloorGeometry(mesh);
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
    makeTriplanar(wallMaterial, 1 / WALL_TILE_METERS);
    for (const mesh of walls) {
      // Triplanar blends by the surface normal; a shell exported without normals
      // would otherwise sample to black. Recompute them if they're missing.
      if (!mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals();
      mesh.material = wallMaterial;
      // The enclosing shell (walls + roof) otherwise casts a shadow across the
      // whole interior floor under the single overhead directional light — a real
      // venue is lit from inside, so the building envelope shouldn't self-shadow.
      // TradeShowModel reads this flag when it assigns shadow flags (furniture and
      // the stage still cast their own local shadows for depth).
      mesh.userData.tseNoCastShadow = true;
    }
  }
}

/**
 * Reworks a MeshStandardMaterial to sample its `map` by world-space triplanar
 * projection instead of UVs: the texture is projected down each of the three world
 * axes and the results blended by the surface normal, so every face gets correctly-
 * oriented, correctly-scaled texture no matter which way it points or whether the
 * mesh has usable UVs at all. This is why the wall shell — which ships with no
 * useful UVs and would otherwise render as one flat colour — actually shows its
 * board-formed texture. Only the colour map is triplanar-sampled; lighting/shadow/
 * env terms are left to the stock shader.
 */
function makeTriplanar(material: MeshStandardMaterial, scale: number): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.triScale = { value: scale };
    shader.vertexShader =
      'varying vec3 vTriWorldPos;\nvarying vec3 vTriWorldNormal;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vTriWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vTriWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader =
      'varying vec3 vTriWorldPos;\nvarying vec3 vTriWorldNormal;\nuniform float triScale;\n' +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec3 triBlend = abs(vTriWorldNormal);
          triBlend /= (triBlend.x + triBlend.y + triBlend.z + 1e-5);
          vec4 triColor =
            texture2D(map, vTriWorldPos.zy * triScale) * triBlend.x +
            texture2D(map, vTriWorldPos.xz * triScale) * triBlend.y +
            texture2D(map, vTriWorldPos.xy * triScale) * triBlend.z;
          diffuseColor *= triColor;
        #endif`,
      );
  };
  // Distinguish this material's compiled program from a stock one in three's cache.
  material.customProgramCacheKey = () => 'triplanar-map';
}
