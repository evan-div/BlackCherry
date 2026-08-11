import type { RefObject } from 'react';
import type { Group } from 'three';
import { ExplorerCanvas } from './ExplorerCanvas';
import { SceneRoot } from './SceneRoot';
import { LoadingScreen } from '../ui/LoadingScreen';
import type { Hotspot } from '../config/types';
import type { MovementKeys } from '../controls/useKeyboard';
import { DEFAULT_CAMERA, TRADE_SHOW_CAMERA } from '../config/defaults';

interface LazySceneProps {
  modelUrl?: string;
  decoderPath?: string;
  ktx2Path?: string;
  hotspots: Hotspot[];
  cardAnchorRef: RefObject<HTMLDivElement | null>;
  isTouchOnly: boolean;
  keysRef: RefObject<MovementKeys>;
  onModelLoaded: (scene: Group) => void;
  onContextLost: () => void;
}

/**
 * Everything that depends on three.js/react-three-fiber/drei lives behind this one
 * default export, so `React.lazy(() => import('./LazyScene'))` in TradeShowExplorer
 * is the sole boundary that keeps three.js out of the eagerly-loaded shell bundle.
 * LoadingScreen is deliberately rendered here (not in the eager shell) because it
 * depends on drei's useProgress — the eager shell's own Suspense fallback is what
 * covers the window before this chunk itself has finished downloading.
 */
export default function LazyScene({ onContextLost, ...sceneProps }: LazySceneProps) {
  const hasModel = !!sceneProps.modelUrl;
  const cameraDefaults = hasModel ? TRADE_SHOW_CAMERA : DEFAULT_CAMERA;
  // Far plane must clear the whole scene depth-wise or distant geometry clips; the
  // real trade show hall is ~120m deep vs. the placeholder's ~40m.
  const far = hasModel ? 400 : 100;

  return (
    <>
      <ExplorerCanvas
        initialCameraPosition={cameraDefaults.position}
        far={far}
        onContextLost={onContextLost}
      >
        <SceneRoot {...sceneProps} />
      </ExplorerCanvas>
      <LoadingScreen />
    </>
  );
}
