import { useEffect, useRef } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { DirectionalLight } from 'three';

interface LightingProps {
  /** True when the real (hall-sized) model is loaded — scales the key light and its
   * shadow frustum to venue dimensions instead of the small placeholder's. */
  venueScale?: boolean;
}

/** A neutral IBL environment plus one shadow-casting key light, tuned for a static,
 * mostly-baked show floor (see README Blender export checklist). The shadow map is
 * rendered once on mount/scene-change rather than every frame — `gl.shadowMap.autoUpdate`
 * is disabled in ExplorerCanvas, so we flag `needsUpdate` here after the light settles. */
export function Lighting({ venueScale = false }: LightingProps) {
  const lightRef = useRef<DirectionalLight>(null);
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    // One 2048 map stretched over the whole walkable area: the venue needs a much
    // wider frustum than the placeholder or most of the hall simply has no shadows
    // (anything outside the frustum renders unshadowed, which reads as floating).
    const extent = venueScale ? 80 : 18;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -extent;
    light.shadow.camera.right = extent;
    light.shadow.camera.top = extent;
    light.shadow.camera.bottom = -extent;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = venueScale ? 220 : 40;
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
      <Environment resolution={256} environmentIntensity={venueScale ? 0.85 : 0.6}>
        <Lightformer form="rect" intensity={2.2} position={[0, 10, -14]} scale={[16, 8, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.1} position={[-10, 6, 5]} rotation={[0, Math.PI / 3, 0]} scale={[8, 5, 1]} color="#c9d4ff" />
        <Lightformer form="rect" intensity={1.1} position={[10, 6, 5]} rotation={[0, -Math.PI / 3, 0]} scale={[8, 5, 1]} color="#ffe9c4" />
        <Lightformer form="ring" intensity={1.6} position={[0, 12, 0]} scale={14} color="#ffffff" />
        <Lightformer form="rect" intensity={0.7} position={[0, 8, 18]} rotation={[0, Math.PI, 0]} scale={[14, 6, 1]} color="#f2f4f8" />
      </Environment>
      {/* Hemisphere fill (cool ceiling light down, warm floor bounce up) reads far
       * more like a real interior than a flat ambient term, which grays everything. */}
      <hemisphereLight args={['#dfe6f5', '#b8ac9c', venueScale ? 0.5 : 0.35]} />
      <ambientLight intensity={0.12} />
      <directionalLight
        ref={lightRef}
        position={venueScale ? [35, 50, 25] : [10, 14, 6]}
        intensity={venueScale ? 1.7 : 1.4}
        castShadow
      />
    </>
  );
}
