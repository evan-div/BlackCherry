/** Where a hotspot sits in the scene. Prefer `node` — it survives model re-exports;
 * `position` is a fallback for scenes without authored anchor Empties. */
export type HotspotAnchor =
  | { type: 'node'; nodeName: string; offset?: [number, number, number] }
  | { type: 'position'; position: [number, number, number] };

export type HotspotCategory =
  | 'product'
  | 'signage'
  | 'furniture'
  | 'av'
  | 'decor'
  | (string & {});

export interface HotspotCameraView {
  /** Explicit camera position to fly to. If omitted, one is derived by backing off from the anchor. */
  position?: [number, number, number];
  /** Orbit distance to use when focusing this hotspot (meters). */
  distance?: number;
}

export interface Hotspot {
  /** Stable, unique, kebab-case. */
  id: string;
  anchor: HotspotAnchor;
  title: string;
  description: string;
  image?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  category?: HotspotCategory;
  cameraView?: HotspotCameraView;
}

export interface ExplorerTheme {
  accent?: string;
  accentText?: string;
  surface?: string;
  surfaceText?: string;
  fontFamily?: string;
  radius?: string;
  overlayScrim?: string;
}

export type ExplorerMode = 'explore' | 'walk';

export interface Vec3Tuple extends Array<number> {
  0: number;
  1: number;
  2: number;
}

export interface CameraDefaults {
  position: [number, number, number];
  target: [number, number, number];
  minDistance: number;
  maxDistance: number;
  /** Radians. 0 = straight down, PI = straight up. */
  minPolarAngle: number;
  maxPolarAngle: number;
  /** Axis-aligned box clamping where the orbit target may be panned to. */
  targetBounds: { min: [number, number, number]; max: [number, number, number] };
}

export interface WalkDefaults {
  eyeHeight: number;
  speed: number;
  sprintMultiplier: number;
  /** Capsule radius used for wall clearance. */
  radius: number;
  /** Hard XZ fallback clamp, used when no COLLISION mesh is present. */
  bounds: { min: [number, number]; max: [number, number] };
}

export interface ExplorerProps {
  modelUrl?: string;
  hotspots?: Hotspot[];
  theme?: ExplorerTheme;
  defaultMode?: ExplorerMode;
  /** Aspect ratio (width / height) used to size the component when no explicit height is given. */
  aspect?: number;
  /** Explicit height (CSS value) or 'fill' to take 100% of the parent's height. */
  height?: string | 'fill';
  decoderPath?: string;
  ktx2Path?: string;
  /** 'viewport' (default) mounts the heavy 3D chunk only once scrolled near; 'eager' mounts immediately. */
  lazy?: 'viewport' | 'eager';
  posterUrl?: string;
  onHotspotSelect?: (id: string | null) => void;
  onModeChange?: (mode: ExplorerMode) => void;
}
