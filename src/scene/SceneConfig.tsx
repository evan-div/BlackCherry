import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { CameraDefaults, WalkDefaults } from '../config/types';
import {
  DEFAULT_CAMERA,
  DEFAULT_WALK,
  TRADE_SHOW_CAMERA,
  TRADE_SHOW_WALK,
} from '../config/defaults';

interface SceneConfig {
  camera: CameraDefaults;
  walk: WalkDefaults;
}

const SceneConfigContext = createContext<SceneConfig>({
  camera: DEFAULT_CAMERA,
  walk: DEFAULT_WALK,
});

/** Picks camera/walk tuning appropriate to whatever's actually in the scene: the
 * small procedural placeholder, or the real (much larger) trade show model. Consumed
 * by OrbitRig/WalkRig/CameraTransition/collision instead of importing the raw
 * defaults directly, so those don't need to know which scene is active. */
export function SceneConfigProvider({ hasModel, children }: { hasModel: boolean; children: ReactNode }) {
  const value: SceneConfig = hasModel
    ? { camera: TRADE_SHOW_CAMERA, walk: TRADE_SHOW_WALK }
    : { camera: DEFAULT_CAMERA, walk: DEFAULT_WALK };
  return <SceneConfigContext.Provider value={value}>{children}</SceneConfigContext.Provider>;
}

export function useSceneConfig(): SceneConfig {
  return useContext(SceneConfigContext);
}
