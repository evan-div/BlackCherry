import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Material, Mesh, MeshStandardMaterial } from 'three';
import { configureGltfLoader } from '../loaders/gltf';
import { useExplorerStore } from '../state/store';

interface TradeShowModelProps {
  url: string;
  decoderPath?: string;
  ktx2Path?: string;
  onLoaded?: (scene: import('three').Group) => void;
}

/** True when a mesh's material carries Blender-baked lighting. The export bakes
 * each architectural surface to an EMISSIVE lightmap with a BLACK baseColorFactor,
 * so the surface renders exactly as baked and runtime lights contribute nothing to
 * it — that's what makes the bake authoritative rather than something our lighting
 * rig fights with. Detected via the `BAKED_` material-name prefix the exporter
 * uses. */
function isBakedSurface(mesh: Mesh): boolean {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some((m) => m instanceof Material && m.name.startsWith('BAKED_'));
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
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of materials) {
    if (m instanceof MeshStandardMaterial && m.normalMap && m.normalMap === m.map) {
      m.normalMap = null;
      m.needsUpdate = true;
    }
  }
}

/** Loads the Blender-exported trade show GLB. Collision proxy nodes (named
 * `COLLISION*`) are authored to be invisible in the final render — they're hidden
 * here rather than removed so `collision.ts` can still find and raycast against them.
 * Static geometry gets `matrixAutoUpdate = false` since nothing in this scene moves. */
export function TradeShowModel({ url, decoderPath, ktx2Path, onLoaded }: TradeShowModelProps) {
  const { gl, invalidate } = useThree();
  const isWalking = useExplorerStore((s) => s.mode === 'walk');
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
        // Baked surfaces already contain their own shadowing, so they neither cast
        // (doubling up onto un-baked props) nor receive (their black baseColor makes
        // received light a no-op anyway — skipping it is a free saving). Un-baked
        // objects — props, furniture — still use the runtime rig normally.
        const baked = isBakedSurface(obj);
        obj.castShadow = !baked;
        obj.receiveShadow = !baked;
      }
      obj.matrixAutoUpdate = false;
      obj.updateMatrix();
    });
    onLoaded?.(scene);
  }, [scene, onLoaded]);

  // The roof is only wanted from the inside. In explore mode the orbit camera sits
  // above the venue, where an intact ceiling means you stare at its outer surface
  // and see nothing of the floor — so hide it there and restore it for walk mode,
  // where being enclosed is the whole point.
  useEffect(() => {
    scene.traverse((obj) => {
      if (/^Ceiling/i.test(obj.name)) obj.visible = isWalking;
    });
    invalidate();
  }, [scene, isWalking, invalidate]);

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
