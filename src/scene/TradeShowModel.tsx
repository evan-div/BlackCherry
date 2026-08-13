import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Material, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { configureGltfLoader } from '../loaders/gltf';

/** Clear ceiling height of the venue, in metres — measured from the export
 * (`Wall_Main_North` is 7.510 m tall and the ceiling panels sit flush at 7.49 m). */
const ROOF_HEIGHT = 7.5;

interface TradeShowModelProps {
  url: string;
  decoderPath?: string;
  ktx2Path?: string;
  onLoaded?: (scene: import('three').Group) => void;
}

/**
 * True for a material authored as UNLIT — the export's convention for anything whose
 * appearance is already finished and must not be re-lit at runtime: a BLACK base colour
 * (so lights and shadows contribute nothing) carrying its entire appearance in emissive.
 *
 * Deliberately a STRUCTURAL test rather than a name-prefix one, so it covers the baked
 * shell, the ceiling emitters, and whatever the next export names them.
 *
 * The emissive test accepts a factor OR a texture, because both kinds belong here for
 * LIGHTING purposes. They differ for TONE MAPPING — see isBakedSurface. A black base
 * with NEITHER (the curtains) is genuinely just a black object and is correctly
 * excluded; it still wants normal lighting and shadow behaviour.
 */
function isUnlitMaterial(m: Material): boolean {
  if (!(m instanceof MeshStandardMaterial)) return false;
  const baseIsBlack = m.color.r === 0 && m.color.g === 0 && m.color.b === 0;
  if (!baseIsBlack) return false;
  return !!m.emissiveMap || m.emissive.r > 0 || m.emissive.g > 0 || m.emissive.b > 0;
}

/**
 * True for the subset of unlit materials that are DISPLAY-REFERRED — a finished picture
 * rather than a radiance value — and so must skip the renderer's tone mapping.
 *
 * The discriminator is the emissive TEXTURE, and the distinction is real rather than
 * cosmetic. The 30 baked shell maps are photographs of the lit room with Blender's AgX
 * view transform already applied, at emissiveIntensity 1: they are finished sRGB and
 * running ACES over them grades twice. The ceiling LED strips carry no texture — just a
 * colour at emissiveIntensity 15, which is scene-referred HDR that NEEDS tone mapping to
 * land in display range.
 *
 * Getting this backwards is visible: opting the LEDs out clips them to flat yellow
 * (the export measured #ffffb8 against a #fdfaf8 reference, vs #fffcec when tone mapped).
 * An earlier export note advised extending the opt-out to everything named `EMISSIVE_*`
 * and was later retracted on measurement — hence testing what the material IS rather
 * than what it's called.
 */
function isBakedSurface(m: Material): boolean {
  return isUnlitMaterial(m) && !!(m as MeshStandardMaterial).emissiveMap;
}

function meshMaterials(mesh: Mesh): Material[] {
  return (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(
    (m): m is Material => m instanceof Material,
  );
}

/** True when any of a mesh's materials is unlit (see isUnlitMaterial). */
function isUnlitSurface(mesh: Mesh): boolean {
  return meshMaterials(mesh).some(isUnlitMaterial);
}

/** Renders the baked shell exactly as authored (see isBakedSurface). Everything else —
 * the runtime-lit props AND the HDR ceiling emitters — keeps ACES. */
function optOutBakedFromToneMapping(mesh: Mesh): void {
  for (const m of meshMaterials(mesh)) {
    if (isBakedSurface(m) && m.toneMapped) {
      m.toneMapped = false;
      m.needsUpdate = true;
    }
  }
}

/**
 * Repairs an export bug: the tablecloth materials wire the SAME image as both
 * `map` and `normalMap`. A colour texture read as a tangent-space normal map
 * produces violent bogus shading — the "crumpled foil" look the cloths had.
 * A single image can never validly be both, so dropping the normal map is a safe,
 * general rule that also survives re-exports (rather than patching the asset,
 * which a re-export would undo).
 */
function repairSelfReferencingNormalMaps(mesh: Mesh): void {
  for (const m of meshMaterials(mesh)) {
    if (m instanceof MeshStandardMaterial && m.normalMap && m.normalMap === m.map) {
      m.normalMap = null;
      m.needsUpdate = true;
    }
  }
}

/** Below this, a texture transform is magnifying a crop rather than tiling: a scale of
 * 0.1 stretches a tenth of the image across the whole surface (10x magnification). The
 * two tablecloths sit at 0.028 and 0.035; nothing legitimate in this scene comes near.
 * A texture atlas is the one thing that uses sub-1 scales on purpose, which is why this
 * is a deliberately extreme threshold rather than "anything under 1" — an atlas would
 * need more than 10 cells per axis to trip it. */
const MIN_SANE_TEXTURE_SCALE = 0.1;

/**
 * Repairs an inverted `KHR_texture_transform` on colour maps.
 *
 * The tablecloth materials ship a transform with scale ~0.03, so instead of TILING the
 * 2048x2048 linen weave across the cloth they magnify a 71x71 pixel corner of it over
 * the whole thing — about 24 px/m, where the venue floor gets 90. That turns individual
 * thread crossings into 4 cm grey blobs, which is the mottled tinfoil look the cloths
 * have. The value is almost certainly a reciprocal slip (0.0347 = 1/28.8): tiling wants
 * a scale ABOVE 1, magnifying uses one below.
 *
 * Resetting to identity maps the full weave once across the authored UVs (~680 px/m),
 * so the cloth reads as smooth fabric. Deliberately identity rather than a chosen tiling
 * factor — the right number depends on how much real fabric the photo covers, which the
 * asset doesn't record. That's an art call for the export, not something to invent here;
 * this only removes a value that cannot be right.
 */
function repairMagnifiedTextureTransforms(mesh: Mesh): void {
  for (const m of meshMaterials(mesh)) {
    if (!(m instanceof MeshStandardMaterial) || !m.map) continue;
    const { x, y } = m.map.repeat;
    if (x >= MIN_SANE_TEXTURE_SCALE && y >= MIN_SANE_TEXTURE_SCALE) continue;
    // GLTFLoader clones a texture before applying the transform, so this is scoped to
    // the affected material rather than every user of the shared image.
    m.map.repeat.set(1, 1);
    m.map.offset.set(0, 0);
    m.map.needsUpdate = true;
  }
}

/** Loads the Blender-exported trade show GLB. Collision proxy nodes (named
 * `COLLISION*`) are authored to be invisible in the final render — they're hidden
 * here rather than removed so `collision.ts` can still find and raycast against them.
 * Static geometry gets `matrixAutoUpdate = false` since nothing in this scene moves. */
export function TradeShowModel({ url, decoderPath, ktx2Path, onLoaded }: TradeShowModelProps) {
  const { gl, invalidate } = useThree();
  const extend = useMemo(() => configureGltfLoader(gl, decoderPath, ktx2Path), [gl, decoderPath, ktx2Path]);
  // useDraco/useMeshopt are forced false: drei's own defaults run *after* our extend
  // callback and would overwrite our self-hosted DRACOLoader with its CDN-pathed one.
  const { scene } = useGLTF(url, false, false, extend);

  useEffect(() => {
    scene.traverse((obj) => {
      if (obj.name.startsWith('COLLISION')) {
        obj.visible = false;
      }
      if (obj instanceof Mesh) {
        repairSelfReferencingNormalMaps(obj);
        repairMagnifiedTextureTransforms(obj);
        optOutBakedFromToneMapping(obj);
        // Unlit surfaces already contain their own shadowing, so they neither cast
        // (doubling up onto the runtime-lit props) nor receive (their black base
        // colour makes received light a no-op anyway — skipping it is a free
        // saving). Note this uses the WIDER unlit test, not the baked one: the
        // ceiling LED strips are tone mapped like a normal material but should still
        // glow rather than drop shadows. Everything else — tables, chairs, banners —
        // uses the runtime rig normally.
        const unlit = isUnlitSurface(obj);
        obj.castShadow = !unlit;
        obj.receiveShadow = !unlit;
      }
      obj.matrixAutoUpdate = false;
      obj.updateMatrix();
    });
    onLoaded?.(scene);
  }, [scene, onLoaded]);

  // The roof gets in the way exactly when you're looking down from above it: an intact
  // ceiling means you stare at its outer surface and see nothing of the floor.
  //
  // So the test is the CAMERA'S HEIGHT, not the mode. Hiding it by mode looked right
  // while the ceiling was low, but the export's own `CAMERA_DEFAULT` puts explore mode
  // at 1.70 m eye height — inside the room — where a mode-based rule opened the roof
  // onto empty backdrop and left a black band above the far wall in the default view.
  // Height covers both cases with one rule: enclosed at room level in either mode,
  // open as soon as you lift the orbit camera over the roofline.
  //
  // Everything mounted in the ceiling toggles with it — the coffer ribs and their LED
  // strips, and the recessed panels an earlier export used. They're separate top-level
  // nodes rather than children of the ceiling, so hiding only the ceiling itself would
  // leave ribs and glowing strips hanging in mid-air between the orbit camera and the
  // floor: the exact view the ceiling is hidden to reveal. The pattern deliberately
  // covers the retired `FIXTURE_*` naming too, so the toggle survives in both
  // directions if that geometry ever comes back.
  const roofRef = useRef<Object3D[]>([]);
  useEffect(() => {
    const roof: Object3D[] = [];
    scene.traverse((obj) => {
      if (/^(Ceiling|Coffer|FIXTURE)/i.test(obj.name)) roof.push(obj);
    });
    roofRef.current = roof;
  }, [scene]);

  // Runs only on frames that are actually rendered (frameloop="demand"), i.e. while the
  // camera is moving — so this is a float compare on exactly the frames that can change
  // the answer, and the traverse above is not repeated per frame.
  const roofVisibleRef = useRef(true);
  useFrame(({ camera }) => {
    // Hysteresis band around the 7.50 m roofline: without it, hovering the orbit camera
    // right at the threshold flickers the whole roof on and off frame to frame.
    const y = camera.position.y;
    const visible = roofVisibleRef.current ? y < ROOF_HEIGHT + 0.5 : y < ROOF_HEIGHT - 0.5;
    if (visible === roofVisibleRef.current) return;
    roofVisibleRef.current = visible;
    for (const obj of roofRef.current) obj.visible = visible;
    invalidate();
  });

  // dispose={null}: `scene` comes from drei's URL-keyed GLTF cache, shared across
  // remounts (e.g. an error-retry unmounts and remounts this component with the
  // same cached scene). R3F's default unmount behavior disposes any object3D it
  // removes, including primitives — without this, the *first* unmount would
  // dispose geometries the cache still thinks are usable, breaking every
  // subsequent mount for this URL. True final disposal is handled explicitly in
  // TradeShowExplorer's unmount effect instead (see useModelDisposal).
  return <primitive object={scene} dispose={null} />;
}

/** Call once (e.g. on viewport-intersection) to overlap the GLB fetch with the rest
 * of React tree setup rather than waiting for the model component to mount. */
export function preloadTradeShowModel(url: string) {
  useGLTF.preload(url);
}
