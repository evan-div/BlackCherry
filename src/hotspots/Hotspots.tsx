import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useHotspotAnchors } from '../hooks/useHotspotAnchors';
import type { Hotspot } from '../config/types';
import { useExplorerStore } from '../state/store';
import { HotspotMarker } from './HotspotMarker';

interface HotspotsProps {
  hotspots: Hotspot[];
  ready: boolean;
  /** DOM node of the (screen-space) HotspotCard, positioned imperatively here every
   * frame rather than through React state/props — the card's screen position
   * changes every time the camera moves, and routing that through React would mean
   * a re-render per frame for the whole overlay. */
  cardAnchorRef: RefObject<HTMLDivElement | null>;
  isTouchOnly: boolean;
}

const CARD_WIDTH = 320;
// Extra top margin the close button needs, since it overlaps the card's top-right
// corner rather than sitting inside it (see .tse-hotspot-card__close).
const CARD_MARGIN = 20;
const LOOK_AT_MAX_DISTANCE = 15;
// cos(~23deg) — a fairly tight "crosshair" cone so the nearest hotspot in view
// doesn't steal the prompt from something the player is more precisely aiming at.
const LOOK_AT_MIN_DOT = 0.92;
const _projected = new Vector3();
const _direction = new Vector3();
const _forward = new Vector3();
const _toHotspot = new Vector3();

export function Hotspots({ hotspots, ready, cardAnchorRef, isTouchOnly }: HotspotsProps) {
  const anchors = useHotspotAnchors(hotspots, ready);
  const activeHotspotId = useExplorerStore((s) => s.activeHotspotId);
  const mode = useExplorerStore((s) => s.mode);
  const hoverHotspot = useExplorerStore((s) => s.hoverHotspot);
  const onCameraCommand = useExplorerStore((s) => s.onCameraCommand);
  const dispatchCameraCommand = useExplorerStore((s) => s.dispatchCameraCommand);
  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;
  const hotspotsRef = useRef(hotspots);
  hotspotsRef.current = hotspots;
  const lookAtRef = useRef<string | null>(null);
  const { invalidate, camera } = useThree((s) => ({ invalidate: s.invalidate, camera: s.camera }));

  // Selecting/closing a hotspot is a discrete UI event, not a camera move — under
  // frameloop="demand" nothing would otherwise trigger the frame this projector
  // needs to run and (re)position or hide the card.
  useEffect(() => {
    invalidate();
  }, [activeHotspotId, invalidate]);

  // Resolves the DOM-side hotspot list's "fly to <id>" request into a concrete
  // world-space camera pose — only this component (inside the Canvas) knows the
  // resolved anchor positions, so it does the backing-off math and re-dispatches a
  // plain 'flyTo' that OrbitRig already knows how to animate toward.
  useEffect(() => {
    return onCameraCommand((cmd) => {
      if (cmd.type !== 'flyToHotspot') return;
      const anchorPos = anchorsRef.current.get(cmd.id);
      if (!anchorPos) return;
      const hotspot = hotspotsRef.current.find((h) => h.id === cmd.id);
      const distance = hotspot?.cameraView?.distance ?? 4;

      let targetPos: [number, number, number];
      if (hotspot?.cameraView?.position) {
        targetPos = hotspot.cameraView.position;
      } else {
        _direction.subVectors(camera.position, anchorPos);
        if (_direction.lengthSq() < 1e-6) _direction.set(0, 0.3, 1);
        _direction.normalize();
        const eye = anchorPos.clone().addScaledVector(_direction, distance);
        eye.y = anchorPos.y + distance * 0.35;
        targetPos = [eye.x, eye.y, eye.z];
      }

      dispatchCameraCommand({
        type: 'flyTo',
        position: targetPos,
        target: [anchorPos.x, anchorPos.y, anchorPos.z],
      });
    });
  }, [onCameraCommand, dispatchCameraCommand, camera]);

  useFrame((state) => {
    // Walk mode: pointer lock hides and freezes the OS cursor, so clicking a
    // screen-positioned marker doesn't work while locked. Instead, find whichever
    // hotspot is most centered in the camera's forward view (within a tight cone
    // and reasonable distance) and surface it via the existing hover state — reused
    // here as "looked at", which also gives the marker the same hover styling —
    // then WalkInstructions prompts "Press E" and useKeyboardMovement's 'KeyE'
    // handler selects it.
    if (mode === 'walk') {
      _forward.set(0, 0, -1).applyQuaternion(state.camera.quaternion);
      let bestId: string | null = null;
      let bestDot = LOOK_AT_MIN_DOT;
      anchorsRef.current.forEach((pos, id) => {
        _toHotspot.subVectors(pos, state.camera.position);
        const dist = _toHotspot.length();
        if (dist > LOOK_AT_MAX_DISTANCE || dist < 0.01) return;
        _toHotspot.divideScalar(dist);
        const dot = _toHotspot.dot(_forward);
        if (dot > bestDot) {
          bestDot = dot;
          bestId = id;
        }
      });
      if (bestId !== lookAtRef.current) {
        lookAtRef.current = bestId;
        hoverHotspot(bestId);
      }
    } else if (lookAtRef.current !== null) {
      lookAtRef.current = null;
      hoverHotspot(null);
    }

    // The bottom sheet on touch devices, and the fixed middle-left card in walk
    // mode, are both positioned entirely by CSS — skip writing an inline transform
    // that would fight it. Clear any transform/display left over from a previous
    // explore-mode projection so the CSS placement actually takes effect.
    if (isTouchOnly || mode === 'walk') {
      const card = cardAnchorRef.current;
      if (card) {
        card.style.transform = '';
        card.style.display = '';
      }
      return;
    }
    const el = cardAnchorRef.current;
    if (!el) return;
    const id = activeHotspotId;
    const pos = id ? anchorsRef.current.get(id) : undefined;
    if (!id || !pos) {
      el.style.display = 'none';
      return;
    }

    _projected.copy(pos).project(state.camera);

    // Behind the camera — hide rather than let it fly across the screen.
    if (_projected.z > 1) {
      el.style.display = 'none';
      return;
    }

    const { width, height } = state.size;
    let x = (_projected.x * 0.5 + 0.5) * width;
    let y = (-_projected.y * 0.5 + 0.5) * height;

    // Clamp so the card never renders partially outside the canvas.
    x = Math.min(Math.max(x, CARD_MARGIN), Math.max(CARD_MARGIN, width - CARD_WIDTH - CARD_MARGIN));
    y = Math.min(Math.max(y, CARD_MARGIN), Math.max(CARD_MARGIN, height - CARD_MARGIN - 40));

    el.style.display = '';
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });

  if (!ready) return null;

  return (
    <>
      {hotspots.map((hotspot) => {
        const position = anchors.get(hotspot.id);
        if (!position) return null;
        return <HotspotMarker key={hotspot.id} hotspot={hotspot} position={position} />;
      })}
    </>
  );
}
