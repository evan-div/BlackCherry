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
  sprintMultiplier: 1.8,
  radius: 0.35,
  bounds: {
    min: [-15, -11],
    max: [15, 11],
  },
};

/**
 * Tuned to the real trade-show.glb (a ~103m x 121m conference hall — bounding box
 * roughly X:[-61, 41] Z:[-16, 105], see the export checklist in README for how
 * these numbers were derived: no CAMERA_DEFAULT/COLLISION_* empties were authored
 * in this particular export, so these are hand-picked from the model's actual
 * geometry rather than read from the asset itself). Default view frames the main
 * stage/podium area near the origin.
 */
export const TRADE_SHOW_CAMERA: CameraDefaults = {
  position: [22, 13, 32],
  target: [0, 2, 4],
  minDistance: 2,
  maxDistance: 160,
  minPolarAngle: 0.1,
  maxPolarAngle: 1.5,
  targetBounds: {
    min: [-58, 0, -15],
    max: [38, 20, 100],
  },
};

export const TRADE_SHOW_WALK: WalkDefaults = {
  eyeHeight: 1.65,
  speed: 3.5,
  sprintMultiplier: 1.8,
  radius: 0.35,
  // Trimmed a few meters inside the model's actual bounding box (bbox min/max is
  // roughly X:[-61,41] Z:[-16,105]) as a safety margin against walking through
  // unseen exterior walls — there's no authored COLLISION mesh to clamp against.
  bounds: {
    min: [-55, -12],
    max: [35, 96],
  },
};

export const DEFAULT_THEME: Required<ExplorerTheme> = {
  accent: '#c8102e',
  accentText: '#ffffff',
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
