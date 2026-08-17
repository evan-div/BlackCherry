import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import {
  Box3,
  CubeCamera,
  Mesh,
  PMREMGenerator,
  SRGBColorSpace,
  Vector3,
  WebGLCubeRenderTarget,
} from 'three';
import type { Group, Texture } from 'three';
import { isSelfIlluminated } from './bakedMaterials';

/** Cube face size for the probe. The result is a diffuse-dominant irradiance field, so
 * it is smooth by nature and gains nothing from resolution — PMREM blurs most of it away.
 * 256 keeps the one-time cost to six cheap renders. */
const PROBE_SIZE = 256;

/** Eye height to probe at, matching the export's `CAMERA_DEFAULT`. */
const PROBE_HEIGHT = 1.7;

/** Where to stand the probe: the centre of the authored collision floor, which spans
 * both slabs and is a contract node. Falls back to the model's own bounds. */
function probeCenter(model: Group): Vector3 {
  const floor = model.getObjectByName('COLLISION_Floor');
  const box = new Box3().setFromObject(floor ?? model);
  const center = box.getCenter(new Vector3());
  center.y = box.min.y + PROBE_HEIGHT;
  return center;
}

/**
 * Builds the scene's image-based lighting by PHOTOGRAPHING THE ROOM, rather than
 * hand-placing lights to imitate it.
 *
 * The venue shell is emissive: walls, floors, ceiling and LED strips all carry their own
 * baked light. Everything else — 88 curtains, 98 tablecloths, the counters and metalwork,
 * about 1,600 m² of curtain alone — is ordinary PBR and integrates to exactly zero
 * without illumination, which is why those props render black or near-black on their own.
 *
 * So the room already contains its own answer: a cubemap captured from inside the shell
 * IS the irradiance arriving at any prop standing in it, warm LED tint and all. That
 * beats a hand-built rig on two counts. It is more accurate — the props pick up the same
 * colour and directionality the bake has, instead of an approximation I tuned by eye
 * against a floor-luminance figure. And it cannot drift: every re-bake, ceiling redesign
 * or LED colour change flows through automatically, where hand-placed lights silently go
 * stale (this rig had already been retuned by hand three times across three exports).
 *
 * The props are hidden for the capture so they contribute nothing to the light that is
 * about to illuminate them — otherwise black fabric would darken its own environment.
 *
 * One probe for the whole venue is an approximation: it cannot capture that the entry
 * hall is brighter than the main floor. That is the standard tradeoff for a single IBL,
 * and it is a far smaller error than the rig it replaces.
 */
function buildShellEnvironment(
  gl: import('three').WebGLRenderer,
  scene: import('three').Scene,
  model: Group,
): Texture {
  const hidden: Mesh[] = [];
  model.traverse((obj) => {
    if (obj instanceof Mesh && obj.visible && !isSelfIlluminated(obj)) {
      obj.visible = false;
      hidden.push(obj);
    }
  });

  // The captured shell is DISPLAY-REFERRED — its materials opt out of tone mapping and
  // write finished sRGB values. Flagging the target sRGB is what makes three decode those
  // back to linear radiance when the IBL is sampled. Capturing into a linear target
  // instead reads a 0.5 sRGB pixel as 0.5 radiance rather than 0.214, over-brightening
  // the whole room by roughly 2.3x — enough to render black velour curtains as tan.
  // 8-bit suits it: the source is clamped to display range, so there is no HDR to keep.
  const target = new WebGLCubeRenderTarget(PROBE_SIZE);
  target.texture.colorSpace = SRGBColorSpace;
  const camera = new CubeCamera(0.1, 200, target);
  camera.position.copy(probeCenter(model));
  try {
    camera.update(gl, scene);
  } finally {
    // Restore before anything can throw its way past the capture — leaving the venue's
    // furniture hidden would be a far worse failure than having no environment.
    for (const obj of hidden) obj.visible = true;
  }

  const pmrem = new PMREMGenerator(gl);
  const environment = pmrem.fromCubemap(target.texture).texture;
  pmrem.dispose();
  target.dispose();
  return environment;
}

/** Installs the probed shell environment as the scene's IBL for as long as the model
 * is mounted. Runs once per model — the venue is static, so the light never changes. */
export function ShellEnvironment({ model }: { model: Group | null }) {
  const { gl, scene, invalidate } = useThree();

  useEffect(() => {
    if (!model) return;
    const previous = scene.environment;
    const environment = buildShellEnvironment(gl, scene, model);
    scene.environment = environment;
    invalidate();
    return () => {
      scene.environment = previous;
      environment.dispose();
    };
  }, [model, gl, scene, invalidate]);

  return null;
}
