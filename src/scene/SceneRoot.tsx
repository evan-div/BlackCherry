import { Suspense, useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { ControlsRig } from '../controls/ControlsRig';
import type { MovementKeys } from '../controls/useKeyboard';
import type { Hotspot } from '../config/types';
import { Hotspots } from '../hotspots/Hotspots';
import { Lighting } from './Lighting';
import { PlaceholderScene } from './PlaceholderScene';
import { ShellEnvironment } from './ShellEnvironment';
import { SceneConfigProvider } from './SceneConfig';
import type { AuthoredCameraPose } from './SceneConfig';
import { TradeShowModel } from './TradeShowModel';

const _world = new Vector3();

/** Reads the export contract's `CAMERA_DEFAULT` / `CAMERA_TARGET` empties out of a
 * loaded model, if the artist authored them (see README's Blender checklist). */
function resolveAuthoredCamera(scene: Group): AuthoredCameraPose | null {
  const positionNode = scene.getObjectByName('CAMERA_DEFAULT');
  const targetNode = scene.getObjectByName('CAMERA_TARGET');
  if (!positionNode && !targetNode) return null;
  const pose: AuthoredCameraPose = {};
  if (positionNode) {
    positionNode.getWorldPosition(_world);
    pose.position = [_world.x, _world.y, _world.z];
  }
  if (targetNode) {
    targetNode.getWorldPosition(_world);
    pose.target = [_world.x, _world.y, _world.z];
  }
  return pose;
}

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
  const [authoredCamera, setAuthoredCamera] = useState<AuthoredCameraPose | null>(null);
  const [loadedModel, setLoadedModel] = useState<Group | null>(null);

  useEffect(() => {
    if (!modelUrl) setReady(true);
  }, [modelUrl]);

  const handleModelLoaded = useCallback(
    (scene: Group) => {
      setAuthoredCamera(resolveAuthoredCamera(scene));
      setLoadedModel(scene);
      setReady(true);
      onModelLoaded?.(scene);
    },
    [onModelLoaded],
  );

  // Fog distance scales with the scene: the placeholder is a ~32m room, the real
  // trade show floor is a ~120m hall — the placeholder's fog range would erase most
  // of the real venue almost immediately.
  const [fogNear, fogFar] = modelUrl ? [60, 150] : [22, 42];
  // The real venue is an interior lit by its own baked lighting, so the void around
  // it should read as unlit space, not daylight — a bright backdrop makes the hall
  // look like a model sitting on a white table and blows out the contrast the bake
  // is carrying. The procedural placeholder keeps its light studio backdrop.
  const backdrop = modelUrl ? '#0a0b0e' : '#dde1e8';

  return (
    <SceneConfigProvider hasModel={!!modelUrl} authoredCamera={authoredCamera}>
      <color attach="background" args={[backdrop]} />
      <fog attach="fog" args={[backdrop, fogNear, fogFar]} />
      <ControlsRig keysRef={keysRef} />
      <Lighting venueScale={!!modelUrl} />
      {/* Mounted after the model resolves: the probe photographs the shell, so it has
        * nothing to capture until the shell exists. */}
      <ShellEnvironment model={loadedModel} />
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
    </SceneConfigProvider>
  );
}
