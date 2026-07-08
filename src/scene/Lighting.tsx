import { useEffect, useRef } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { DirectionalLight } from 'three';

/** A neutral IBL environment plus one shadow-casting key light, tuned for a static,
 * mostly-baked show floor (see README Blender export checklist). The shadow map is
 * rendered once on mount/scene-change rather than every frame — `gl.shadowMap.autoUpdate`
 * is disabled in ExplorerCanvas, so we flag `needsUpdate` here after the light settles. */
export function Lighting() {
  const lightRef = useRef<DirectionalLight>(null);
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -18;
    light.shadow.camera.right = 18;
    light.shadow.camera.top = 18;
    light.shadow.camera.bottom = -18;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 40;
    light.shadow.bias = -0.0015;
    light.shadow.camera.updateProjectionMatrix();
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate]);

  return (
    <>
      {/* Fully procedural IBL (no external HDR fetch) — an embedded widget must never
       * depend on a third-party CDN being reachable. Lightformers approximate a soft
       * studio/warehouse environment for reflections and ambient fill. */}
      <Environment resolution={256} environmentIntensity={0.6}>
        <Lightformer form="rect" intensity={2} position={[0, 6, -10]} scale={[12, 6, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1} position={[-8, 4, 4]} rotation={[0, Math.PI / 3, 0]} scale={[6, 4, 1]} color="#c9d4ff" />
        <Lightformer form="rect" intensity={1} position={[8, 4, 4]} rotation={[0, -Math.PI / 3, 0]} scale={[6, 4, 1]} color="#fff2c9" />
        <Lightformer form="ring" intensity={1.5} position={[0, 8, 0]} scale={10} color="#ffffff" />
      </Environment>
      <ambientLight intensity={0.25} />
      <directionalLight
        ref={lightRef}
        position={[10, 14, 6]}
        intensity={1.4}
        castShadow
      />
    </>
  );
}
