import type { CameraDefaults, ExplorerTheme, WalkDefaults } from './types';

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
