import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Mesh } from 'three';
import { configureGltfLoader } from '../loaders/gltf';
import { applySurfaceMaterials } from './applySurfaceMaterials';

interface TradeShowModelProps {
  url: string;
  decoderPath?: string;
  ktx2Path?: string;
  onLoaded?: (scene: import('three').Group) => void;
}

/** Loads the Blender-exported trade show GLB. Collision proxy nodes (named
 * `COLLISION*`) are authored to be invisible in the final render — they're hidden
 * here rather than removed so `collision.ts` can still find and raycast against them.
 * Static geometry gets `matrixAutoUpdate = false` since nothing in this scene moves. */
export function TradeShowModel({ url, decoderPath, ktx2Path, onLoaded }: TradeShowModelProps) {
  const { gl } = useThree();
  const extend = useMemo(() => configureGltfLoader(gl, decoderPath, ktx2Path), [gl, decoderPath, ktx2Path]);
  // useDraco/useMeshopt are forced false: drei's own defaults run *after* our extend
  // callback and would overwrite our self-hosted DRACOLoader with its CDN-pathed one.
  const { scene } = useGLTF(url, false, false, extend);

  useEffect(() => {
    // Re-skin the big architectural surfaces (floor → polished concrete, shell →
    // plaster) before freezing matrices below — it reads world matrices and bakes
    // world-space floor UVs, so it must run while matrices are still live. Idempotent
    // across remounts (see applySurfaceMaterials).
    applySurfaceMaterials(scene);

    scene.traverse((obj) => {
      if (obj.name.startsWith('COLLISION')) {
        obj.visible = false;
      }
      if (obj instanceof Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
      obj.matrixAutoUpdate = false;
      obj.updateMatrix();
    });
    onLoaded?.(scene);
  }, [scene, onLoaded]);

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
