import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import {
  Box3,
  CubeCamera,
  HalfFloatType,
  Mesh,
  PMREMGenerator,
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

/**
 * Where to stand the probe: the export's authored `CAMERA_DEFAULT`.
 *
 * Deliberately a named contract node rather than anything derived from geometry, which is
 * the opposite of how the rest of this file identifies things — and the exception is
 * earned. Position barely affects the result: the export measured the floor centre, the
 * collision-floor centre and `CAMERA_DEFAULT` landing within ~6% of each other in the
 * table band. So a geometric derivation buys nothing measurable while adding real failure
 * modes, and it already bit once — "the largest horizontal emissive surface" picks the
 * CEILING, whose footprint slightly exceeds the floor's, which put the probe at 9.2 m
 * facing the void and drained the light out of the whole room.
 *
 * `CAMERA_DEFAULT` is also the most meaningful point available: it is authored at eye
 * height, verified clear of furniture, and it is exactly where the visitor starts.
 */
function probeCenter(model: Group): Vector3 {
  const authored = model.getObjectByName('CAMERA_DEFAULT');
  if (authored) return authored.getWorldPosition(new Vector3());

  // No authored camera — fall back to the middle of the collision floor at eye height,
  // and to the model's own bounds only if that is missing too.
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

  // Half-float, and deliberately NOT flagged with a colour space. Rendering to a non-XR
  // render target writes ColorManagement.workingColorSpace regardless of what the target
  // texture is flagged (WebGLPrograms.getParameters), so what lands here is already
  // scene-linear radiance — flagging it sRGB would not change the write, only add a
  // spurious decode on sampling. Float matters for a different reason: the LED strips
  // reach a radiance near 5, and an 8-bit target cannot hold anything above 1, so it
  // would clip the brightest emitters in the room — exactly the ones supplying its warmth.
  const target = new WebGLCubeRenderTarget(PROBE_SIZE, { type: HalfFloatType });
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
