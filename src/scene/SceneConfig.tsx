import { createContext, useContext, useMemo } from 'react';
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

/** Camera pose authored INSIDE the model per the Blender export contract:
 * `CAMERA_DEFAULT` / `CAMERA_TARGET` empties, resolved by SceneRoot after the
 * GLTF loads. Wins over the hand-tuned config defaults when present, so a
 * re-export can move the opening shot without a code change. */
export interface AuthoredCameraPose {
  position?: [number, number, number];
  target?: [number, number, number];
}

const SceneConfigContext = createContext<SceneConfig>({
  camera: DEFAULT_CAMERA,
  walk: DEFAULT_WALK,
});

/** Picks camera/walk tuning appropriate to whatever's actually in the scene: the
 * small procedural placeholder, or the real (much larger) trade show model. Consumed
 * by OrbitRig/WalkRig/CameraTransition/collision instead of importing the raw
 * defaults directly, so those don't need to know which scene is active. */
export function SceneConfigProvider({
  hasModel,
  authoredCamera,
  children,
}: {
  hasModel: boolean;
  authoredCamera?: AuthoredCameraPose | null;
  children: ReactNode;
}) {
  const value = useMemo<SceneConfig>(() => {
    const base = hasModel
      ? { camera: TRADE_SHOW_CAMERA, walk: TRADE_SHOW_WALK }
      : { camera: DEFAULT_CAMERA, walk: DEFAULT_WALK };
    if (!authoredCamera) return base;
    return {
      ...base,
      camera: {
        ...base.camera,
        ...(authoredCamera.position ? { position: authoredCamera.position } : null),
        ...(authoredCamera.target ? { target: authoredCamera.target } : null),
      },
    };
  }, [hasModel, authoredCamera]);
  return <SceneConfigContext.Provider value={value}>{children}</SceneConfigContext.Provider>;
}

export function useSceneConfig(): SceneConfig {
  return useContext(SceneConfigContext);
}
