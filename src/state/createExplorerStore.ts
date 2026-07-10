import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type { ExplorerMode } from '../config/types';

interface LoadingState {
  active: boolean;
  /** 0-100, or null while progress is indeterminate. */
  progress: number | null;
}

/**
 * Camera commands (reset / fly-to-hotspot) are dispatched through a plain event
 * channel rather than store state, since they're one-shot imperative instructions
 * consumed by OrbitRig inside the Canvas — routing them through React state would
 * force a re-render for every request and fight with the per-frame tween.
 */
export type CameraCommand =
  | { type: 'reset' }
  | { type: 'flyTo'; position: [number, number, number]; target: [number, number, number] }
  // Resolved to a concrete 'flyTo' by Hotspots (inside the Canvas, where anchor
  // world positions are known) — the DOM-side hotspot list only knows an id.
  | { type: 'flyToHotspot'; id: string };

export interface ExplorerState {
  mode: ExplorerMode;
  /** True while the camera is animating between explore/walk poses; input is ignored. */
  transitioning: boolean;
  /** True once the user has explicitly engaged the canvas (click-to-activate gate). */
  activated: boolean;
  loading: LoadingState;
  error: string | null;
  activeHotspotId: string | null;
  hoveredHotspotId: string | null;
  /** True while the guided tour is auto-driving the camera (see useGuidedTour). */
  tourActive: boolean;
  /** Mutable per-frame walk pose, written by WalkRig and read by the DOM minimap's
   * own rAF loop. Deliberately a stable object that gets MUTATED, never replaced —
   * putting x/z/yaw through set() would re-render every store subscriber at frame
   * rate. Not reactive state; just a per-instance shared mailbox. */
  walkPose: { x: number; z: number; yaw: number; hasPose: boolean };
  pointerLockAvailable: boolean;
  isTouchOnly: boolean;
  /** Bumped to force-remount the canvas subtree, e.g. on error retry. */
  retryKey: number;

  setMode: (mode: ExplorerMode) => void;
  /** UI entry point for switching modes: sets the target mode AND flags a camera
   * transition, so CameraTransition eases toward it instead of snapping. */
  requestModeChange: (mode: ExplorerMode) => void;
  setTransitioning: (value: boolean) => void;
  activate: () => void;
  deactivate: () => void;
  selectHotspot: (id: string | null) => void;
  hoverHotspot: (id: string | null) => void;
  setTourActive: (value: boolean) => void;
  setLoading: (loading: Partial<LoadingState>) => void;
  setError: (error: string | null) => void;
  setPointerLockAvailable: (value: boolean) => void;
  setIsTouchOnly: (value: boolean) => void;
  retry: () => void;
  requestReset: () => void;
  requestFlyToHotspot: (id: string) => void;
  onCameraCommand: (fn: (cmd: CameraCommand) => void) => () => void;
  dispatchCameraCommand: (cmd: CameraCommand) => void;
}

/**
 * Creates one isolated store per `<TradeShowExplorer>` instance. This must NOT be a
 * module-level singleton — a host page can legitimately mount more than one
 * explorer, and a shared store would leak mode/error/hotspot state between
 * unrelated instances (each instance's camera-command pub-sub channel is scoped
 * the same way, via closure, for the same reason).
 */
export function createExplorerStore(initialMode: ExplorerMode = 'explore'): StoreApi<ExplorerState> {
  const cameraCommandListeners = new Set<(cmd: CameraCommand) => void>();
  const dispatchCameraCommand = (cmd: CameraCommand) => {
    cameraCommandListeners.forEach((fn) => fn(cmd));
  };
  const onCameraCommand = (fn: (cmd: CameraCommand) => void) => {
    cameraCommandListeners.add(fn);
    return () => cameraCommandListeners.delete(fn);
  };

  return createStore<ExplorerState>((set) => ({
    mode: initialMode,
    // Starting directly in walk mode still needs a transition — the Canvas's
    // initial camera pose is the orbit preset (ExplorerCanvas), not a walk-ready
    // eye-height position, so CameraTransition runs once on mount to fix that up.
    transitioning: initialMode !== 'explore',
    activated: false,
    loading: { active: true, progress: null },
    error: null,
    activeHotspotId: null,
    hoveredHotspotId: null,
    tourActive: false,
    walkPose: { x: 0, z: 0, yaw: 0, hasPose: false },
    pointerLockAvailable: false,
    isTouchOnly: false,
    retryKey: 0,

    setMode: (mode) => set({ mode }),
    requestModeChange: (mode) => set((s) => (s.mode === mode ? s : { mode, transitioning: true })),
    setTransitioning: (value) => set({ transitioning: value }),
    activate: () => set({ activated: true }),
    deactivate: () => set({ activated: false, activeHotspotId: null }),
    selectHotspot: (id) => set({ activeHotspotId: id }),
    hoverHotspot: (id) => set({ hoveredHotspotId: id }),
    setTourActive: (value) => set({ tourActive: value }),
    setLoading: (loading) => set((s) => ({ loading: { ...s.loading, ...loading } })),
    setError: (error) => set({ error }),
    setPointerLockAvailable: (value) => set({ pointerLockAvailable: value }),
    setIsTouchOnly: (value) => set({ isTouchOnly: value }),
    retry: () => set((s) => ({ error: null, retryKey: s.retryKey + 1, loading: { active: true, progress: null } })),
    requestReset: () => dispatchCameraCommand({ type: 'reset' }),
    requestFlyToHotspot: (id) => dispatchCameraCommand({ type: 'flyToHotspot', id }),
    onCameraCommand,
    dispatchCameraCommand,
  }));
}
