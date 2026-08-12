import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { CanvasErrorBoundary } from './scene/CanvasErrorBoundary';
import { ScenePoster } from './ui/ScenePoster';
import { Overlay } from './ui/Overlay';
import { ErrorScreen } from './ui/ErrorScreen';
import { HotspotCard } from './ui/HotspotCard';
import { MobileFallback } from './ui/MobileFallback';
import './ui/styles.css';
import { themeToCssVars } from './config/theme';
import { DEFAULT_WALK, TRADE_SHOW_WALK } from './config/defaults';
import { placeholderHotspots, tradeShowHotspots } from './config/hotspots';
import type { ExplorerProps } from './config/types';
import { useAnalyticsEvents } from './hooks/useAnalyticsEvents';
import { useDeactivationTriggers } from './hooks/useDeactivationTriggers';
import { useDeepLink, readDeepLinkIntent } from './hooks/useDeepLink';
import type { DeepLinkIntent } from './hooks/useDeepLink';
import { useGuidedTour } from './hooks/useGuidedTour';
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
  // Read any shareable-link intent once, up front, so the store can start in the
  // requested mode (and so it's captured before the URL-sync effect rewrites it).
  const [deepLinkIntent] = useState<DeepLinkIntent | null>(() =>
    props.deepLink ? readDeepLinkIntent() : null,
  );
  // Walk mode has no supported input scheme on touch-only devices (see
  // ModeToggle/WalkInstructions) — never honor a walk request there.
  const wantWalk = props.defaultMode === 'walk' || deepLinkIntent?.mode === 'walk';
  const [store] = useState(() => createExplorerStore(!isTouchOnly && wantWalk ? 'walk' : 'explore'));
  return (
    <ExplorerStoreContext.Provider value={store}>
      <ExplorerInner {...props} deepLinkIntent={deepLinkIntent} />
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
  onAnalyticsEvent,
  onLeadSubmit,
  desktopOnly = false,
  deepLink = false,
  deepLinkIntent,
}: ExplorerProps & { deepLinkIntent: DeepLinkIntent | null }) {
  const resolvedHotspots = hotspots ?? (modelUrl ? tradeShowHotspots : placeholderHotspots);
  const rootRef = useRef<HTMLDivElement>(null);
  const cardAnchorRef = useRef<HTMLDivElement>(null);
  const emitAnalytics = useAnalyticsEvents(onAnalyticsEvent);
  useDeepLink(deepLink, deepLinkIntent, resolvedHotspots);
  useDeactivationTriggers(rootRef);
  usePointerLockAvailable();
  const webglSupported = useWebglSupported();
  const isTouchOnly = useIsTouchOnly();
  const inViewport = useInViewport(rootRef);
  // Desktop-only: touch devices get the content-and-CTA fallback instead of the 3D
  // scene. Gating `shouldMountScene` on it (rather than only branching the render
  // below) is what actually keeps phones from paying for 3D — that flag drives the
  // Canvas mount, the lazy three.js import AND the multi-megabyte GLB warmup, all of
  // which would otherwise fire the moment the widget scrolled into view.
  const showMobileFallback = desktopOnly && isTouchOnly;
  const shouldMountScene =
    !showMobileFallback && webglSupported && (lazyMode === 'eager' || inViewport);

  const setLoading = useExplorerStore((s) => s.setLoading);
  const setError = useExplorerStore((s) => s.setError);
  const retry = useExplorerStore((s) => s.retry);
  const retryKey = useExplorerStore((s) => s.retryKey);
  const error = useExplorerStore((s) => s.error);
  const mode = useExplorerStore((s) => s.mode);
  const requestModeChange = useExplorerStore((s) => s.requestModeChange);
  const selectHotspot = useExplorerStore((s) => s.selectHotspot);
  const activeHotspotId = useExplorerStore((s) => s.activeHotspotId);
  const hoveredHotspotId = useExplorerStore((s) => s.hoveredHotspotId);
  // Hotspots.tsx repurposes "hovered" as "currently looked at" while in walk mode
  // (see its useFrame) — kept in a ref so the 'E' keydown handler always reads the
  // latest value without re-subscribing the keyboard hook on every look change.
  const hoveredHotspotIdRef = useRef(hoveredHotspotId);
  useEffect(() => {
    hoveredHotspotIdRef.current = hoveredHotspotId;
  }, [hoveredHotspotId]);

  // The explorer root must hold real DOM focus for WASD keydown to reach its
  // (non-global) listeners at all — see useKeyboardMovement. Also re-focus it
  // whenever a hotspot card closes: its close button is itself a focused DOM
  // element, and browsers drop focus to <body> when a focused element is
  // removed rather than restoring whatever was focused before — silently
  // breaking WASD (which needs focus on this root) while mouse-look (a
  // window-level listener, focus-independent) keeps working, which is exactly
  // the "I can look around but can't move" bug this guards against.
  useEffect(() => {
    if (mode === 'walk' && !activeHotspotId) rootRef.current?.focus();
  }, [mode, activeHotspotId]);

  const handleCtaClick = useCallback(
    (hotspotId: string, ctaUrl: string) => emitAnalytics({ type: 'cta_clicked', hotspotId, ctaUrl }),
    [emitAnalytics],
  );
  const handleLeadSubmit = useCallback(
    async (lead: Parameters<NonNullable<typeof onLeadSubmit>>[0]) => {
      // Await the host first so a rejection propagates to the form (error + retry)
      // and analytics only records genuinely captured leads.
      await onLeadSubmit?.(lead);
      emitAnalytics({ type: 'lead_submitted', hotspotId: lead.hotspotId });
    },
    [onLeadSubmit, emitAnalytics],
  );
  const { tourActive, startTour, stopTour } = useGuidedTour(rootRef, resolvedHotspots, emitAnalytics);
  const handleTourStop = useCallback(() => stopTour('stopped'), [stopTour]);
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
    if (!webglSupported && !showMobileFallback) {
      setError('This browser or device does not support WebGL, which the 3D explorer requires.');
      setLoading({ active: false });
    }
  }, [webglSupported, showMobileFallback, setError, setLoading]);

  useEffect(() => {
    // The procedural placeholder has nothing to await — clear the loading state as
    // soon as it mounts. When a real modelUrl is set, the lazy scene's onLoaded
    // callback below clears it instead, once the GLTF has actually resolved.
    if (!modelUrl && shouldMountScene) {
      setLoading({ active: false });
    }
  }, [modelUrl, shouldMountScene, setLoading]);

  // Asset warmup. Without this the two big downloads are serialized: the GLB
  // fetch can't begin until the three.js chunk has downloaded, parsed, and
  // mounted the model component. A plain fetch() here just primes the HTTP
  // cache, so the loader's own request later is a cache hit. Fired from two
  // triggers: pointer-enter over the widget (a strong "about to engage" signal
  // that can beat the viewport gate) and the scene actually being told to mount.
  const warmedRef = useRef(false);
  const warmAssets = useCallback(() => {
    if (warmedRef.current) return;
    warmedRef.current = true;
    import('./scene/LazyScene');
    if (modelUrl) {
      fetch(modelUrl).catch(() => {
        // Purely opportunistic — the real load path reports its own errors.
      });
    }
  }, [modelUrl]);
  useEffect(() => {
    if (shouldMountScene) warmAssets();
  }, [shouldMountScene, warmAssets]);

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

  useEffect(() => {
    if (showMobileFallback) emitAnalytics({ type: 'mobile_fallback_shown' });
  }, [showMobileFallback, emitAnalytics]);

  const sizeStyle: CSSProperties =
    height === 'fill'
      ? { height: '100%' }
      : height
        ? { height }
        : { aspectRatio: String(aspect) };

  if (showMobileFallback) {
    return (
      <div
        ref={rootRef}
        className="tse-root tse-root--mobile"
        style={{ ...themeToCssVars(theme), ...(height ? sizeStyle : null) }}
      >
        <MobileFallback
          hotspots={resolvedHotspots}
          posterUrl={posterUrl}
          onCtaClick={handleCtaClick}
          onLeadSubmit={onLeadSubmit ? handleLeadSubmit : undefined}
        />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="tse-root"
      style={{ ...themeToCssVars(theme), ...sizeStyle }}
      tabIndex={-1}
      onPointerEnter={warmAssets}
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
      <Overlay
        hotspots={resolvedHotspots}
        tour={{ active: tourActive, onStart: startTour, onStop: handleTourStop }}
        walkBounds={(modelUrl ? TRADE_SHOW_WALK : DEFAULT_WALK).bounds}
      />
      <HotspotCard
        hotspots={resolvedHotspots}
        anchorRef={cardAnchorRef}
        onSelect={onHotspotSelect}
        onCtaClick={handleCtaClick}
        onLeadSubmit={onLeadSubmit ? handleLeadSubmit : undefined}
      />
      <ErrorScreen onRetry={handleRetry} />
    </div>
  );
}
