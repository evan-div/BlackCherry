import type { CameraDefaults, ExplorerTheme, WalkDefaults } from './types';

/** Tuned to the procedural PlaceholderScene's small (~32x24m) footprint. Used
 * whenever no `modelUrl` is set. See scene/SceneConfig.tsx for how this and
 * TRADE_SHOW_CAMERA/WALK are selected based on whether a real model is loaded. */
export const DEFAULT_CAMERA: CameraDefaults = {
  position: [9, 6, 11],
  target: [0, 1.2, 0],
  minDistance: 3,
  maxDistance: 26,
  minPolarAngle: 0.15,
  maxPolarAngle: 1.45,
  targetBounds: {
    min: [-16, 0, -12],
    max: [16, 4, 12],
  },
};

export const DEFAULT_WALK: WalkDefaults = {
  eyeHeight: 1.65,
  speed: 3,
  sprintMultiplier: 2.5,
  radius: 0.35,
  bounds: {
    min: [-15, -11],
    max: [15, 11],
  },
};

/**
 * Tuned to the real trade-show.glb. Its VISIBLE geometry spans roughly
 * X:[-31, 21] Z:[-9, 53] — a ~52m x 61m hall.
 *
 * `position`/`target` here are only a fallback: that export authors `CAMERA_DEFAULT`
 * and `CAMERA_TARGET` empties, which SceneRoot resolves on load and which override
 * these (see scene/SceneConfig.tsx). They're kept so the app still frames the venue
 * sensibly if a future export drops those empties.
 */
export const TRADE_SHOW_CAMERA: CameraDefaults = {
  position: [3, 14, 42],
  target: [3, 2, 4],
  minDistance: 2,
  maxDistance: 110,
  minPolarAngle: 0.1,
  maxPolarAngle: 1.5,
  targetBounds: {
    min: [-31, 0, -9],
    max: [21, 14, 53],
  },
};

export const TRADE_SHOW_WALK: WalkDefaults = {
  eyeHeight: 1.65,
  speed: 3.5,
  sprintMultiplier: 2.5,
  radius: 0.35,
  // Trimmed just inside the authored COLLISION_Floor (X:[-29.5,20.8] Z:[-8.3,52.6]),
  // which now matches the visible venue. With COLLISION_Walls present, walk mode
  // raycasts against those proxies for real blocking; this box is only the outer
  // backstop for anywhere a ray misses.
  bounds: {
    min: [-29, -8],
    max: [20, 52],
  },
};

export const DEFAULT_THEME: Required<ExplorerTheme> = {
  accent: '#aab947',
  // Dark ink rather than white: the accent green is light enough that white text on
  // it lands around 2.2:1, well under WCAG AA. Against #12141a it's ~8.4:1.
  accentText: '#12141a',
  surface: '#12141a',
  surfaceText: '#f4f4f6',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  radius: '10px',
  overlayScrim: 'rgba(10, 10, 14, 0.82)',
};

export const DECODER_PATHS = {
  draco: '/draco/',
  ktx2: '/basis/',
};

/** Max device pixel ratio to render at. Capped lower on touch-only devices at runtime. */
export const DPR_RANGE: [number, number] = [1, 2];
export const DPR_TOUCH_CAP = 1.5;

export const CAMERA_TRANSITION_SECONDS = 0.8;
