import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { LinearSRGBColorSpace, Material, Mesh, MeshStandardMaterial, type Object3D } from 'three';
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

/**
 * True when a mesh's lighting is already resolved offline and it should sit out the
 * runtime shadow pass entirely — neither casting (which would double up onto the props)
 * nor receiving (its shadows are in the bake).
 *
 * Covers both ways the export bakes: the unlit emissive shell, and the floors, which
 * carry a real `lightMap` alongside a lit concrete albedo. The floors matter most here.
 * Being lit materials they'd otherwise default into the shadow pass and self-shadow —
 * a large flat plane both casting and receiving is the classic shadow-acne case — while
 * contributing nothing, since the lightmap's irradiance dwarfs the runtime key light.
 */
function hasBakedLighting(mesh: Mesh): boolean {
  return meshMaterials(mesh).some(
    (m) => isUnlitMaterial(m) || (m instanceof MeshStandardMaterial && m.lightMap !== null),
  );
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

/**
 * Multiplier applied to the floor lightmaps once they're moved into the `lightMap` slot.
 *
 * The export bakes irradiance divided by 96 to fit 8-bit, and three.js applies the same
 * Lambert 1/PI that Cycles does, so the theoretical value is simply 96. Measured against
 * the previous export's floor — same camera, same walls, which did not change — the match
 * lands at 82. Being within 15% of theory is the point: it says the pipeline is understood.
 *
 * The export's own recommendation was 2700, calibrated with the lightmap left on an sRGB
 * decode (see LIGHTMAP_COLOR_SPACE). That is 33x theory, and the gap was never a constant —
 * it was the gamma curve, which is why it also mottled the floor rather than just
 * brightening it. Re-measure if ExplorerCanvas ever changes tone mapping.
 */
const FLOOR_LIGHTMAP_INTENSITY = 82;

/**
 * Lightmaps hold LINEAR irradiance, not colour.
 *
 * The export encodes them as sRGB — reasonably, since every other map in the file is
 * colour, and while the shell's lightmaps were display-referred AgX pictures used as
 * emissive that was correct. The floor's is different in kind: raw irradiance scaled to
 * fit 8-bit. Decoding that through the sRGB curve crushes the darks far harder than the
 * brights, so the floor arrives both too bright and visibly mottled with chroma noise —
 * gamma error, not compression. Overriding to linear costs nothing (three picks the
 * non-sRGB internal format for the compressed texture) and puts the numbers back where
 * the physics expects them.
 */
const LIGHTMAP_COLOR_SPACE = LinearSRGBColorSpace;

/**
 * Moves a lightmap out of the emissive slot and into `lightMap`, where it belongs.
 *
 * glTF has no lightmap slot, so the export parks the floor's baked lighting in
 * `emissiveTexture` purely because that's a channel glTF will carry along with the second
 * UV set it needs. Left there it would be ADDED to the surface — a glowing floor —
 * instead of MULTIPLYING the concrete albedo, which is the whole point of splitting them:
 * the concrete's character is 1-3 mm scratches, and a lightmap with 1-2 cm texels averages
 * every one of them away. Albedo and lighting have to travel separately for the grain to
 * survive.
 *
 * Detected structurally, by the emissive map sitting on a DIFFERENT UV channel than the
 * base colour map. A genuine emissive decal shares the base colour's UVs; a lightmap needs
 * its own non-overlapping unwrap, which is exactly why it's on TEXCOORD_1. That reads the
 * intent out of the data rather than trusting the `FLOOR_` name to survive the next export.
 *
 * These materials stay tone mapped, unlike the unlit shell — they carry scene-referred
 * radiance rather than a finished AgX picture, which is the default, so nothing to set.
 */
function promoteLightmapFromEmissive(mesh: Mesh): void {
  for (const m of meshMaterials(mesh)) {
    if (!(m instanceof MeshStandardMaterial)) continue;
    if (!m.emissiveMap || !m.map || m.emissiveMap.channel === m.map.channel) continue;
    m.lightMap = m.emissiveMap;
    m.lightMap.colorSpace = LIGHTMAP_COLOR_SPACE;
    m.lightMap.needsUpdate = true;
    m.lightMapIntensity = FLOOR_LIGHTMAP_INTENSITY;
    m.emissiveMap = null;
    m.emissive.setRGB(0, 0, 0);
    m.needsUpdate = true;
  }
}

/** Emissive intensity a screen displaying artwork is allowed to reach. Not an invented
 * number: it's what `Material.002` (the centre stage screen) already uses for the exact
 * same authoring pattern, so this makes the side screens match a panel the export
 * already considers correct. */
const SCREEN_EMISSIVE_INTENSITY = 1;

/**
 * Caps the emissive intensity of screens that are DISPLAYING something.
 *
 * A material carrying the same image as both its base colour and its emissive map is a
 * self-illuminated picture — a screen, not a lamp. Pushing one to a high emissive
 * strength is self-defeating: past about 1 the picture clips, and the brighter it goes
 * the less of it survives. The projector screens ship at 14, which turns their navy
 * artwork (~0.10, 0.12, 0.23) into (1.4, 1.7, 3.2) — every channel over range, blue
 * furthest, so ACES rolls it off to a flat pale violet and the lime text washes to
 * near-white. The screens end up too bright to read.
 *
 * Scoped by the same-texture-in-both-slots test so it only catches picture screens. The
 * ceiling LED strips also run a high strength (15) and are deliberately untouched — they
 * carry no emissive texture, so there is no image for the intensity to destroy, and that
 * brightness is the whole point of a light source.
 *
 * This is a tuning override rather than a repair of invalid data: unlike a colour image
 * wired as a normal map, 14 is a legal value that is simply too high here. It's a no-op
 * once the export lowers it.
 */
function clampScreenEmissive(mesh: Mesh): void {
  for (const m of meshMaterials(mesh)) {
    if (!(m instanceof MeshStandardMaterial)) continue;
    if (!m.emissiveMap || m.emissiveMap !== m.map) continue;
    if (m.emissiveIntensity <= SCREEN_EMISSIVE_INTENSITY) continue;
    // emissiveIntensity is a plain uniform — no needsUpdate/recompile required.
    m.emissiveIntensity = SCREEN_EMISSIVE_INTENSITY;
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
        // Before the shadow decision below, which reads the lightMap this installs.
        promoteLightmapFromEmissive(obj);
        clampScreenEmissive(obj);
        optOutBakedFromToneMapping(obj);
        // Anything whose lighting is already baked sits out the shadow pass. Note this
        // is the WIDER test, not the tone-mapping one: the ceiling LED strips are tone
        // mapped like a normal material but should still glow rather than drop shadows.
        // Everything else — tables, chairs, banners — uses the runtime rig normally.
        const baked = hasBakedLighting(obj);
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
