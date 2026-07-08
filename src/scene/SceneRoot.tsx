import { Suspense, useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { Group } from 'three';
import { ControlsRig } from '../controls/ControlsRig';
import type { MovementKeys } from '../controls/useKeyboard';
import type { Hotspot } from '../config/types';
import { Hotspots } from '../hotspots/Hotspots';
import { Lighting } from './Lighting';
import { PlaceholderScene } from './PlaceholderScene';
import { TradeShowModel } from './TradeShowModel';

interface SceneRootProps {
  modelUrl?: string;
  decoderPath?: string;
  ktx2Path?: string;
  hotspots: Hotspot[];
  cardAnchorRef: RefObject<HTMLDivElement | null>;
  isTouchOnly: boolean;
  keysRef: RefObject<MovementKeys>;
  onModelLoaded?: (scene: Group) => void;
}

/** Composes the static parts of the scene graph: lighting plus either the real
 * Blender export or the procedural placeholder when no model URL is configured yet.
 * Hotspot anchor resolution (`ready`) is deliberately gated on the model/placeholder
 * actually being mounted — resolving too early would silently miss node-name
 * anchors that don't exist in the scene graph yet. */
export function SceneRoot({
  modelUrl,
  decoderPath,
  ktx2Path,
  hotspots,
  cardAnchorRef,
  isTouchOnly,
  keysRef,
  onModelLoaded,
}: SceneRootProps) {
  const [ready, setReady] = useState(!modelUrl);

  useEffect(() => {
    if (!modelUrl) setReady(true);
  }, [modelUrl]);

  const handleModelLoaded = useCallback(
    (scene: Group) => {
      setReady(true);
      onModelLoaded?.(scene);
    },
    [onModelLoaded],
  );

  return (
    <>
      <color attach="background" args={['#dde1e8']} />
      <fog attach="fog" args={['#dde1e8', 22, 42]} />
      <ControlsRig keysRef={keysRef} />
      <Lighting />
      <Suspense fallback={null}>
        {modelUrl ? (
          <TradeShowModel
            url={modelUrl}
            decoderPath={decoderPath}
            ktx2Path={ktx2Path}
            onLoaded={handleModelLoaded}
          />
        ) : (
          <PlaceholderScene />
        )}
      </Suspense>
      <Hotspots
        hotspots={hotspots}
        ready={ready}
        cardAnchorRef={cardAnchorRef}
        isTouchOnly={isTouchOnly}
      />
    </>
  );
}
