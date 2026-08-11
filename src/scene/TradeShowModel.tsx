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

/**
 * True for a material authored as UNLIT — the export's convention for anything whose
 * appearance is already finished and must not be re-lit or re-graded at runtime:
 * a BLACK base colour (so lights and shadows contribute nothing) carrying its entire
 * appearance in emissive.
 *
 * Deliberately a STRUCTURAL test rather than a name-prefix one. It started as a
 * `BAKED_` prefix check, which silently missed the phase-4 light fixtures
 * (`EMISSIVE_Ceiling_Panel`) — those are unlit the same way but carry a flat
 * emissiveFactor with no emissive texture, so they'd have been tone-mapped and
 * rendered grey. Testing the authoring contract itself covers the shell, the
 * fixtures, and whatever the next export names its unlit surfaces.
 *
 * Note the emissive test accepts a factor OR a texture: fixtures have only a factor,
 * baked shell surfaces have a lightmap. A black base with NEITHER (the curtains) is
 * genuinely just a black object and is correctly excluded — it still wants normal
 * lighting and shadow behaviour.
 */
function isUnlitMaterial(m: Material): boolean {
  if (!(m instanceof MeshStandardMaterial)) return false;
  const baseIsBlack = m.color.r === 0 && m.color.g === 0 && m.color.b === 0;
  if (!baseIsBlack) return false;
  return !!m.emissiveMap || m.emissive.r > 0 || m.emissive.g > 0 || m.emissive.b > 0;
}

function meshMaterials(mesh: Mesh): Material[] {
  return (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(
    (m): m is Material => m instanceof Material,
  );
}

/** True when any of a mesh's materials is unlit (see isUnlitMaterial). */
function isUnlitSurface(mesh: Mesh): boolean {
  return meshMaterials(mesh).some(isUnlitMaterial);
}

/**
 * Unlit surfaces are DISPLAY-REFERRED: Blender's AgX view transform is already applied
 * inside the baked lightmaps (and the fixture emissives are authored to sit against
 * them), so they are finished pictures rather than linear radiance. Running the
 * renderer's ACES pass over them tone-maps a second time, which desaturates and
 * flattens exactly the contrast they were made to carry — the shell reads dull and
 * the light fixtures read grey instead of glowing.
 *
 * Opting them out of tone mapping renders them as authored, while the runtime-lit
 * props — which ARE linear and do want ACES — keep it.
 */
function optOutUnlitFromToneMapping(mesh: Mesh): void {
  for (const m of meshMaterials(mesh)) {
    if (isUnlitMaterial(m) && m.toneMapped) {
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
        optOutUnlitFromToneMapping(obj);
        // Unlit surfaces already contain their own shadowing, so they neither cast
        // (doubling up onto the runtime-lit props) nor receive (their black base
        // colour makes received light a no-op anyway — skipping it is a free
        // saving). This covers the baked shell and the emissive light fixtures,
        // which should glow rather than drop shadows. Everything else — tables,
        // chairs, banners — still uses the runtime rig normally.
        const unlit = isUnlitSurface(obj);
        obj.castShadow = !unlit;
        obj.receiveShadow = !unlit;
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
