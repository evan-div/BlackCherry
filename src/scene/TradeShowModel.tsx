import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh, MeshStandardMaterial, NoColorSpace, type Object3D } from 'three';
import { isBakedSurface, isSelfIlluminated, isUnlitMaterial, meshMaterials } from './bakedMaterials';
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
 * Residual white-balance on the baked shell, as a per-channel multiplier.
 *
 * The venue's warm cast has been corrected at source in stages — the ceiling LED strips
 * from 2230K to 3500K, then the three warm overhead lamp groups taken halfway to white —
 * and this is the shrinking remainder, kept for taste. The walls stay warm deliberately:
 * `beige_wall_001_diff_4k` at linear R/B 1.317 is the venue's actual paint, and
 * neutralising it was measured at only 5% on the ceiling and makes the walls read grey.
 *
 * It is now [1, 1, 1] — neutral. The source fixes closed the gap, so the venue renders
 * exactly as baked and the app carries no colour compensation at all. Kept as a
 * documented knob rather than deleted, because it is the lever to reach for if a future
 * re-bake drifts warm again; reaching for it should be a deliberate, temporary act.
 *
 * Applied to the SHELL rather than the props, which is the point. The shell is
 * display-referred and renders this multiplier directly, and the environment probe
 * photographs the shell — so tinting the shell tints the light the props receive by the
 * same amount, automatically. Grading the props alone would leave furniture that
 * disagrees with the room it stands in.
 *
 * For reference if it is ever needed again, measured over a fixed explore-mode frame and
 * luminance-neutral by design: [0.955, 1, 1.065] takes the whole-frame R-B from 25.0 to
 * 19.6 with mean luma holding at ~140. The correction fell from [0.91, 1, 1.135] to half
 * that to nothing as the emitter colours were fixed at source.
 *
 * Purely a taste knob, and the only one in this file: [1, 1, 1] renders the bake exactly
 * as authored, and pushing red down / blue up cools further.
 */
const SHELL_WHITE_BALANCE: [number, number, number] = [1.0, 1.0, 1.0];

/** Renders the baked shell as authored apart from the white balance above. Everything
 * else — the runtime-lit props AND the HDR ceiling emitters — keeps ACES. */
function gradeBakedSurface(mesh: Mesh): void {
  for (const m of meshMaterials(mesh)) {
    if (!(m instanceof MeshStandardMaterial) || !isBakedSurface(m)) continue;
    if (m.toneMapped) m.toneMapped = false;
    // emissiveFactor is white on every baked material, so this sets rather than scales.
    m.emissive.setRGB(...SHELL_WHITE_BALANCE);
    m.needsUpdate = true;
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

/** Anisotropy is cheap but not free, and the returns flatten off well before the 16x
 * most desktop GPUs report. 8 covers the grazing angles walk mode actually reaches. */
const MAX_USEFUL_ANISOTROPY = 8;

/** The chunk the detail multiply is injected after. Kept as a constant so the guard
 * below and the injection can't drift apart. */
const EMISSIVE_CHUNK = '#include <emissivemap_fragment>';

/**
 * Multiplies the floors' grain detail map over their baked lighting.
 *
 * The floors are baked exactly like the rest of the shell, but concrete's character is
 * 1-3 mm scratches and cracks while a lightmap texel covers 2-3 cm — so the bake averages
 * every one of them away. The grain therefore ships separately, as a tiled high-pass
 * detail map, and gets multiplied back over the bake here. Because it modulates an
 * already-display-referred value, the result stays display-referred: the floors keep the
 * same tone curve as the walls, which is what splitting albedo out of the bake had broken.
 *
 * The map is normalised to a mean of 0.5 and read as `texel * 2`, so it averages to
 * exactly 1.0 and preserves the bake's brightness — it adds contrast, not exposure. The
 * export measures 7.5x the high-frequency energy for a 0.01% shift in mean.
 *
 * Detected structurally: an UNLIT material (black base, so the map cannot be albedo —
 * black times anything is black) that nonetheless carries a base colour texture. The only
 * reason to attach a texture whose contribution is mathematically zero is to smuggle it
 * through a slot glTF will carry, which is precisely what this is.
 */
function applyBakedDetailMap(mesh: Mesh, maxAnisotropy: number): void {
  for (const m of meshMaterials(mesh)) {
    if (!(m instanceof MeshStandardMaterial)) continue;
    if (!isUnlitMaterial(m) || !m.map || !m.emissiveMap) continue;
    // GLTFLoader forces sRGB onto anything in the base colour slot. This is linear data,
    // not colour, so that decode has to be undone or the grain arrives gamma-warped.
    m.map.colorSpace = NoColorSpace;
    // This is the textbook case for anisotropic filtering: a tiled map on a large ground
    // plane, viewed almost edge-on for most of the frame. At default anisotropy the mip
    // chain averages along the view direction and throws the grain away exactly where
    // there's most floor on screen — measured 1.9x the high-frequency energy of the plain
    // bake at a grazing angle, against 7.5x when the export sampled it face-on.
    m.map.anisotropy = Math.min(maxAnisotropy, MAX_USEFUL_ANISOTROPY);
    m.map.needsUpdate = true;
    m.onBeforeCompile = (shader) => {
      // Guarded rather than assumed: if a three.js upgrade renames the chunk, the floor
      // quietly loses its grain, which is far better than shipping a shader that fails
      // to compile and takes the whole scene down with it.
      if (!shader.fragmentShader.includes(EMISSIVE_CHUNK)) return;
      shader.fragmentShader = shader.fragmentShader.replace(
        EMISSIVE_CHUNK,
        `${EMISSIVE_CHUNK}\n\ttotalEmissiveRadiance *= texture2D( map, vMapUv ).g * 2.0;`,
      );
    };
    // Without a distinct cache key three could hand this material a program compiled for
    // an unpatched material with otherwise identical defines.
    m.customProgramCacheKey = () => 'tse-baked-detail';
    m.needsUpdate = true;
  }
}

/** Loads the Blender-exported trade show GLB. Collision proxy nodes (named
 * `COLLISION*`) are authored to be invisible in the final render — they're hidden
 * here rather than removed so `collision.ts` can still find and raycast against them.
 * Static geometry gets `matrixAutoUpdate = false` since nothing in this scene moves. */
export function TradeShowModel({ url, decoderPath, ktx2Path, onLoaded }: TradeShowModelProps) {
  const { gl, invalidate } = useThree();
  const maxAnisotropy = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);
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
        applyBakedDetailMap(obj, maxAnisotropy);
        gradeBakedSurface(obj);
        // Anything whose lighting is already baked sits out the shadow pass. Note this
        // is the WIDER test, not the tone-mapping one: the ceiling LED strips are tone
        // mapped like a normal material but should still glow rather than drop shadows.
        // Everything else — tables, chairs, banners — uses the runtime rig normally.
        const baked = isSelfIlluminated(obj);
        obj.castShadow = !baked;
        obj.receiveShadow = !baked;
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
