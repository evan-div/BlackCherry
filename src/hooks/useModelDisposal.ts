import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** Minimal duck-typed shape we need — deliberately not importing three.js types/
 * runtime here, since this hook lives in the eagerly-loaded shell (see
 * TradeShowExplorer.tsx) and must not pull the 3D bundle in just to dispose it. */
interface DisposableObject3D {
  traverse: (callback: (obj: unknown) => void) => void;
}

function disposeMaterial(material: unknown) {
  if (!material || typeof material !== 'object') return;
  for (const value of Object.values(material as Record<string, unknown>)) {
    if (value && typeof value === 'object' && 'isTexture' in value && 'dispose' in value) {
      (value as { dispose: () => void }).dispose();
    }
  }
  const disposable = material as { dispose?: () => void };
  disposable.dispose?.();
}

/**
 * Explicit final-teardown disposal for a loaded GLTF scene. `<primitive dispose={null}>`
 * (see TradeShowModel) deliberately opts the scene OUT of R3F's automatic
 * dispose-on-unmount, because that scene is shared via drei's URL-keyed cache and
 * gets reused across error-retry remounts within the same session. This hook is
 * the other half of that tradeoff: it runs the real geometry/material/texture
 * disposal (and clears the drei cache entry) exactly once, when the whole
 * `<TradeShowExplorer>` instance is actually torn down for good.
 */
export function useModelDisposal(modelUrl: string | undefined): RefObject<unknown> {
  const sceneRef = useRef<unknown>(null);
  const modelUrlRef = useRef(modelUrl);
  modelUrlRef.current = modelUrl;

  useEffect(() => {
    return () => {
      const scene = sceneRef.current as DisposableObject3D | null;
      if (scene) {
        scene.traverse((obj) => {
          const o = obj as {
            geometry?: { dispose: () => void };
            material?: unknown;
            isInstancedMesh?: boolean;
            dispose?: () => void;
          };
          o.geometry?.dispose();
          if (Array.isArray(o.material)) {
            o.material.forEach(disposeMaterial);
          } else if (o.material) {
            disposeMaterial(o.material);
          }
          // An InstancedMesh owns a GPU buffer beyond its geometry and material —
          // the per-instance transform matrix (and instance colour, if present).
          // The export now ships 21 instanced groups covering 240 objects, so
          // without this their matrix buffers survive teardown. Duck-typed, since
          // this hook must not import three (see above).
          if (o.isInstancedMesh) o.dispose?.();
        });
      }
      const url = modelUrlRef.current;
      if (url) {
        // Dynamic import — clearing the drei cache is only meaningful if the lazy
        // scene chunk was ever loaded; a static import would defeat the code-split.
        import('@react-three/drei').then(({ useGLTF }) => useGLTF.clear(url));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, []);

  return sceneRef;
}
