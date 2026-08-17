import { useEffect, useRef } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { DirectionalLight } from 'three';

interface LightingProps {
  /** True when the real (hall-sized) model is loaded — scales the key light and its
   * shadow frustum to venue dimensions instead of the small placeholder's. */
  venueScale?: boolean;
}

/**
 * Runtime lighting for the NON-baked content — curtains, cloths, counters, metalwork.
 * The venue shell lights itself (see bakedMaterials' isSelfIlluminated) and is untouched
 * by anything here.
 *
 * For the venue, the heavy lifting is done by `ShellEnvironment`, which probes the
 * emissive shell into an IBL. That replaced a hand-built rig — a procedural Lightformer
 * environment plus hemisphere and ambient fills — whose intensities had to be re-tuned by
 * hand against a measured floor luminance on three separate exports, and whose colour had
 * to be warmed by hand to match LED strips the probe simply photographs. Keeping those
 * fills alongside the probe would double-count the same light, so the venue branch below
 * drops them and keeps only the key light, which the IBL cannot provide: a probed
 * environment carries no direction sharp enough to cast the contact shadows that sit the
 * furniture on the floor.
 *
 * The procedural placeholder scene has no shell to photograph, so it keeps the full rig.
 */
export function Lighting({ venueScale = false }: LightingProps) {
  const lightRef = useRef<DirectionalLight>(null);
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    // Frustum covers the walkable venue (~52x61m). Kept as tight as possible: the
    // one 2048 map is spread over this whole extent, so every extra metre costs
    // shadow resolution on the props that actually cast.
    const extent = venueScale ? 34 : 18;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -extent;
    light.shadow.camera.right = extent;
    light.shadow.camera.top = extent;
    light.shadow.camera.bottom = -extent;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = venueScale ? 120 : 40;
    // Wider frustum spreads the same texels thinner — the venue needs a larger
    // bias or the low-res depth comparison speckles every surface with acne.
    light.shadow.bias = venueScale ? -0.0004 : -0.0015;
    light.shadow.normalBias = venueScale ? 0.5 : 0.02;
    light.shadow.camera.updateProjectionMatrix();
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate, venueScale]);

  return (
    <>
      {/* Fully procedural IBL (no external HDR fetch) — an embedded widget must never
       * depend on a third-party CDN being reachable. Lightformers approximate a soft
       * convention-hall environment: a big overhead wash plus cool/warm side fills so
       * materials get directional variation in their reflections instead of a flat
       * single-tone response. The venue supersedes this with a probe of its own shell. */}
      {!venueScale && (
        <>
          <Environment resolution={256} environmentIntensity={0.6}>
            <Lightformer form="rect" intensity={2.2} position={[0, 10, -14]} scale={[16, 8, 1]} color="#ffffff" />
            <Lightformer form="rect" intensity={1.1} position={[-10, 6, 5]} rotation={[0, Math.PI / 3, 0]} scale={[8, 5, 1]} color="#c9d4ff" />
            <Lightformer form="rect" intensity={1.1} position={[10, 6, 5]} rotation={[0, -Math.PI / 3, 0]} scale={[8, 5, 1]} color="#ffe9c4" />
            <Lightformer form="ring" intensity={1.6} position={[0, 12, 0]} scale={14} color="#ffffff" />
            <Lightformer form="rect" intensity={0.7} position={[0, 8, 18]} rotation={[0, Math.PI, 0]} scale={[14, 6, 1]} color="#f2f4f8" />
          </Environment>
          {/* Hemisphere fill (cool ceiling light down, warm floor bounce up) reads far
           * more like a real interior than a flat ambient term, which grays everything. */}
          <hemisphereLight args={['#dfe6f5', '#b8ac9c', 0.35]} />
          <ambientLight intensity={0.12} />
        </>
      )}
      {/* Key light. In the venue this exists almost entirely for contact shadows, so it
       * runs dim: the probed environment already supplies the room's actual brightness,
       * and anything more here would light the props from a direction the bake does not
       * agree with. */}
      <directionalLight
        ref={lightRef}
        position={venueScale ? [18, 34, 26] : [10, 14, 6]}
        intensity={venueScale ? 0.35 : 1.4}
        castShadow
      />
    </>
  );
}
