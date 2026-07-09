import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { CanvasErrorBoundary } from './scene/CanvasErrorBoundary';
import { ScenePoster } from './ui/ScenePoster';
import { Overlay } from './ui/Overlay';
import { ErrorScreen } from './ui/ErrorScreen';
import { HotspotCard } from './ui/HotspotCard';
import './ui/styles.css';
import { themeToCssVars } from './config/theme';
import { placeholderHotspots, tradeShowHotspots } from './config/hotspots';
import type { ExplorerProps } from './config/types';
import { useDeactivationTriggers } from './hooks/useDeactivationTriggers';
import { usePointerLockAvailable } from './hooks/usePointerLockAvailable';
import { useWebglSupported } from './hooks/useWebglSupported';
import { useIsTouchOnly } from './hooks/useIsTouchOnly';
import { useInViewport } from './hooks/useInViewport';
import { useModelDisposal } from './hooks/useModelDisposal';
import { useKeyboardMovement } from './controls/useKeyboard';
import { ExplorerStoreContext, useExplorerStore } from './state/store';
import { createExplorerStore } from './state/createExplorerStore';

// The sole code-split boundary: everything that imports three.js/react-three-fiber
// lives behind this dynamic import, so it never lands in the bundle a host page
// pays for on initial load — see scene/LazyScene.tsx.
const LazyScene = lazy(() => import('./scene/LazyScene'));

/**
 * Public component. Renders as a self-contained box the host page controls the
 * sizing of (never assumes viewport ownership) — pass `aspect` for a responsive
 * ratio, an explicit `height`, or `height="fill"` to fill a sized parent.
 *
 * Each instance gets its own isolated state store (see state/createExplorerStore) —
 * a host page can mount more than one explorer without them interfering.
 */
export function TradeShowExplorer(props: ExplorerProps) {
  const isTouchOnly = useIsTouchOnly();
  // Walk mode has no supported input scheme on touch-only devices (see
  // ModeToggle/WalkInstructions) — never honor a defaultMode="walk" there.
  const [store] = useState(() =>
    createExplorerStore(!isTouchOnly && props.defaultMode === 'walk' ? 'walk' : 'explore'),
  );
  return (
    <ExplorerStoreContext.Provider value={store}>
      <ExplorerInner {...props} />
    </ExplorerStoreContext.Provider>
  );
}

function ExplorerInner({
  modelUrl,
  hotspots,
  theme,
  aspect = 16 / 9,
  height,
  decoderPath,
  ktx2Path,
  lazy: lazyMode = 'viewport',
  posterUrl,
  onHotspotSelect,
}: ExplorerProps) {
  const resolvedHotspots = hotspots ?? (modelUrl ? tradeShowHotspots : placeholderHotspots);
  const rootRef = useRef<HTMLDivElement>(null);
  const cardAnchorRef = useRef<HTMLDivElement>(null);
  useDeactivationTriggers(rootRef);
  usePointerLockAvailable();
  const webglSupported = useWebglSupported();
  const isTouchOnly = useIsTouchOnly();
  const inViewport = useInViewport(rootRef);
  const shouldMountScene = webglSupported && (lazyMode === 'eager' || inViewport);

  const setLoading = useExplorerStore((s) => s.setLoading);
  const setError = useExplorerStore((s) => s.setError);
  const retry = useExplorerStore((s) => s.retry);
  const retryKey = useExplorerStore((s) => s.retryKey);
  const error = useExplorerStore((s) => s.error);
  const mode = useExplorerStore((s) => s.mode);
  const requestModeChange = useExplorerStore((s) => s.requestModeChange);
  const selectHotspot = useExplorerStore((s) => s.selectHotspot);
  const hoveredHotspotId = useExplorerStore((s) => s.hoveredHotspotId);
  // Hotspots.tsx repurposes "hovered" as "currently looked at" while in walk mode
  // (see its useFrame) — kept in a ref so the 'E' keydown handler always reads the
  // latest value without re-subscribing the keyboard hook on every look change.
  const hoveredHotspotIdRef = useRef(hoveredHotspotId);
  useEffect(() => {
    hoveredHotspotIdRef.current = hoveredHotspotId;
  }, [hoveredHotspotId]);

  // The explorer root must hold real DOM focus for WASD keydown to reach its
  // (non-global) listeners at all — see useKeyboardMovement.
  useEffect(() => {
    if (mode === 'walk') rootRef.current?.focus();
  }, [mode]);

  const handleExitWalk = useCallback(() => requestModeChange('explore'), [requestModeChange]);
  const handleInteract = useCallback(() => {
    if (hoveredHotspotIdRef.current) selectHotspot(hoveredHotspotIdRef.current);
  }, [selectHotspot]);
  const keysRef = useKeyboardMovement(rootRef, mode === 'walk', handleExitWalk, handleInteract);
  // Unmounting the Canvas after an error boundary catch also fires a genuine
  // 'webglcontextlost' event during teardown; without this guard that redundant
  // event would stomp the original, more specific error message.
  const errorRef = useRef(error);
  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  useEffect(() => {
    if (!webglSupported) {
      setError('This browser or device does not support WebGL, which the 3D explorer requires.');
      setLoading({ active: false });
    }
  }, [webglSupported, setError, setLoading]);

  useEffect(() => {
    // The procedural placeholder has nothing to await — clear the loading state as
    // soon as it mounts. When a real modelUrl is set, the lazy scene's onLoaded
    // callback below clears it instead, once the GLTF has actually resolved.
    if (!modelUrl && shouldMountScene) {
      setLoading({ active: false });
    }
  }, [modelUrl, shouldMountScene, setLoading]);

  const loadedSceneRef = useModelDisposal(modelUrl);
  const handleModelLoaded = useCallback(
    (scene: unknown) => {
      loadedSceneRef.current = scene;
      setLoading({ active: false });
    },
    [setLoading, loadedSceneRef],
  );

  const handleSceneError = useCallback(
    (message: string) => {
      if (errorRef.current) return;
      setError(message);
      setLoading({ active: false });
    },
    [setError, setLoading],
  );

  const handleRetry = useCallback(async () => {
    if (modelUrl) {
      // Dynamic import rather than a static one — clearing the drei GLTF cache is
      // only meaningful once the lazy scene chunk has actually loaded, and a static
      // import here would defeat the whole point of code-splitting it out.
      const { useGLTF } = await import('@react-three/drei');
      useGLTF.clear(modelUrl);
    }
    retry();
  }, [modelUrl, retry]);

  const sizeStyle: CSSProperties =
    height === 'fill'
      ? { height: '100%' }
      : height
        ? { height }
        : { aspectRatio: String(aspect) };

  return (
    <div
      ref={rootRef}
      className="tse-root"
      style={{ ...themeToCssVars(theme), ...sizeStyle }}
      tabIndex={-1}
    >
      <div className="tse-canvas-wrap">
        {shouldMountScene ? (
          <CanvasErrorBoundary key={retryKey} onError={handleSceneError}>
            <Suspense fallback={<ScenePoster posterUrl={posterUrl} />}>
              <LazyScene
                modelUrl={modelUrl}
                decoderPath={decoderPath}
                ktx2Path={ktx2Path}
                hotspots={resolvedHotspots}
                cardAnchorRef={cardAnchorRef}
                isTouchOnly={isTouchOnly}
                keysRef={keysRef}
                onModelLoaded={handleModelLoaded}
                onContextLost={() => handleSceneError('The 3D renderer lost its context.')}
              />
            </Suspense>
          </CanvasErrorBoundary>
        ) : (
          <ScenePoster posterUrl={posterUrl} />
        )}
      </div>
      <Overlay hotspots={resolvedHotspots} />
      <HotspotCard hotspots={resolvedHotspots} anchorRef={cardAnchorRef} onSelect={onHotspotSelect} />
      <ErrorScreen onRetry={handleRetry} />
    </div>
  );
}
