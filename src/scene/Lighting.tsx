import { useEffect, useRef } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { DirectionalLight } from 'three';

interface LightingProps {
  /** True when the real (hall-sized) model is loaded — scales the key light and its
   * shadow frustum to venue dimensions instead of the small placeholder's. */
  venueScale?: boolean;
}

/** A neutral IBL environment plus one shadow-casting key light. The shadow map is
 * rendered once on mount/scene-change rather than every frame — `gl.shadowMap.autoUpdate`
 * is disabled in ExplorerCanvas, so we flag `needsUpdate` here after the light settles.
 *
 * With the current export this rig only lights the NON-baked content — tables, chairs,
 * banners, counters. The architecture (floors/walls/ceiling) and the ceiling light
 * panels ship with Blender-baked lighting as an emissive map or factor over a black
 * base colour, so they render exactly as baked and are deliberately untouched by
 * anything here (see TradeShowModel's isUnlitSurface).
 *
 * That means these intensities are not a free choice — they have to put the props at
 * the same brightness as the room baked around them, or the furniture reads as cut out
 * and pasted in. They're set from the export's measured floor mean luminance, and the
 * phase-5 ceiling raise moved it 0.579 → 0.712 (a lit ceiling bouncing down), so each
 * term below is scaled by that same ~1.23x. */
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
       * single-tone response. */}
      <Environment resolution={256} environmentIntensity={venueScale ? 0.27 : 0.6}>
        <Lightformer form="rect" intensity={2.2} position={[0, 10, -14]} scale={[16, 8, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.1} position={[-10, 6, 5]} rotation={[0, Math.PI / 3, 0]} scale={[8, 5, 1]} color="#c9d4ff" />
        <Lightformer form="rect" intensity={1.1} position={[10, 6, 5]} rotation={[0, -Math.PI / 3, 0]} scale={[8, 5, 1]} color="#ffe9c4" />
        <Lightformer form="ring" intensity={1.6} position={[0, 12, 0]} scale={14} color="#ffffff" />
        <Lightformer form="rect" intensity={0.7} position={[0, 8, 18]} rotation={[0, Math.PI, 0]} scale={[14, 6, 1]} color="#f2f4f8" />
      </Environment>
      {/* Hemisphere fill (cool ceiling light down, warm floor bounce up) reads far
       * more like a real interior than a flat ambient term, which grays everything.
       *
       * All three of these stay LOW for the baked venue: they light only the handful
       * of un-baked props, which sit inside an interior that already carries its own
       * lighting. At the intensities the old flat-grey model needed they blew those
       * props out to white and flattened the bake's contrast. */}
      <hemisphereLight args={['#dfe6f5', '#b8ac9c', venueScale ? 0.22 : 0.35]} />
      <ambientLight intensity={venueScale ? 0.06 : 0.12} />
      <directionalLight
        ref={lightRef}
        position={venueScale ? [18, 34, 26] : [10, 14, 6]}
        intensity={venueScale ? 0.62 : 1.4}
        castShadow
      />
    </>
  );
}
