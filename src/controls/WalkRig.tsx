import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, MathUtils } from 'three';
import { useExplorerStore } from '../state/store';
import { useSceneConfig } from '../scene/SceneConfig';
import { createCollisionWorld } from './collision';
import type { MovementKeys } from './useKeyboard';

interface WalkRigProps {
  keysRef: RefObject<MovementKeys>;
}

const PITCH_LIMIT = Math.PI / 2 - 0.05;
const LOOK_SENSITIVITY = 0.0025;
const PLAYER_RADIUS = 0.4;
const _euler = new Euler(0, 0, 0, 'YXZ');

/**
 * First-person walk mode. Look is driven by pointer lock when available (click,
 * then move the mouse freely), but a plain click-and-drag ALSO always works — not
 * just as an iOS-Safari-has-no-Pointer-Lock-API fallback, but because pointer lock
 * can silently fail to engage for other reasons (embedding context, browser
 * heuristics), and a "click but nothing happens" dead end is worse than always
 * having a working baseline. Movement integrates WASD against the lightweight
 * collision world (ground height + obstacle/venue bounds).
 */
export function WalkRig({ keysRef }: WalkRigProps) {
  const { camera, gl, scene, invalidate, events } = useThree();
  const pointerLockAvailable = useExplorerStore((s) => s.pointerLockAvailable);
  const activeHotspotId = useExplorerStore((s) => s.activeHotspotId);
  // Mutated per frame below (never replaced) — the minimap reads it on its own
  // rAF loop; see the field's comment in createExplorerStore.
  const walkPose = useExplorerStore((s) => s.walkPose);
  const { walk: walkDefaults } = useSceneConfig();
  const collision = useMemo(() => createCollisionWorld(scene, walkDefaults), [scene, walkDefaults]);

  const lockedRef = useRef(false);
  const draggingRef = useRef(false);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  // Read inside the pointerdown listener below, which is set up once and doesn't
  // re-subscribe on every hotspot-card open/close.
  const activeHotspotIdRef = useRef(activeHotspotId);
  activeHotspotIdRef.current = activeHotspotId;

  // Pick up wherever CameraTransition left the camera (position + facing).
  useEffect(() => {
    _euler.setFromQuaternion(camera.quaternion, 'YXZ');
    yawRef.current = _euler.y;
    pitchRef.current = MathUtils.clamp(_euler.x, -PITCH_LIMIT, PITCH_LIMIT);
  }, [camera]);

  // A hotspot card is a normal clickable UI panel (its CTA link, its close
  // button) — the player needs their real cursor back to use it, not a mouse
  // hidden/captured by pointer lock. Release the lock (and cancel any in-flight
  // drag-look) the moment a card opens; re-acquire it when the card closes so
  // walking resumes exactly where it left off, without an extra click. Closing
  // the card is itself a user gesture, which satisfies pointer lock's activation
  // requirement — but only on that transition, never on this component's own
  // mount, where there's no such gesture to spend.
  const prevActiveHotspotIdRef = useRef<string | null>(null);
  useEffect(() => {
    const wasActive = prevActiveHotspotIdRef.current;
    prevActiveHotspotIdRef.current = activeHotspotId;
    const canvas = gl.domElement;
    if (activeHotspotId) {
      draggingRef.current = false;
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    } else if (wasActive && pointerLockAvailable) {
      try {
        canvas.requestPointerLock()?.catch?.(() => {});
      } catch {
        // Some browsers throw synchronously instead of rejecting a promise —
        // either way, drag-to-look is still available as a fallback.
      }
    }
  }, [activeHotspotId, gl, pointerLockAvailable]);

  useEffect(() => {
    const canvas = gl.domElement;
    // R3F's actual hit-testable surface is its own wrapper div (`events.connected`,
    // set up by the Canvas component), not the bare <canvas> — the canvas itself
    // doesn't receive real browser pointer events. drei's OrbitControls resolves
    // its listener target the same way; attaching straight to gl.domElement here
    // silently never fired at all.
    const target = (events.connected as HTMLElement | undefined) ?? canvas;

    const applyLook = (dx: number, dy: number) => {
      yawRef.current -= dx * LOOK_SENSITIVITY;
      pitchRef.current = MathUtils.clamp(pitchRef.current - dy * LOOK_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT);
      // Mouse movement alone doesn't invalidate anything else under
      // frameloop="demand" — without this, a look update wouldn't actually be
      // re-applied to the camera (or rendered) until something else happened to
      // also trigger a frame.
      invalidate();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (lockedRef.current || draggingRef.current) applyLook(e.movementX, e.movementY);
    };
    const handlePointerDown = () => {
      // A hotspot card is open and owns the cursor — don't hijack it back into
      // drag-look just because the click landed on the canvas behind the card.
      if (activeHotspotIdRef.current) return;
      // Always enable drag-to-look immediately — don't gate it behind pointer lock
      // "availability", since availability doesn't guarantee the request succeeds.
      draggingRef.current = true;
      if (pointerLockAvailable) canvas.requestPointerLock();
    };
    const handlePointerUp = () => {
      draggingRef.current = false;
    };
    const handleLockChange = () => {
      lockedRef.current = document.pointerLockElement === canvas;
    };
    const handleLockError = () => {
      // Denied or unavailable at request time — drag-to-look still works.
      lockedRef.current = false;
    };

    target.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handleLockChange);
    document.addEventListener('pointerlockerror', handleLockError);

    return () => {
      target.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handleLockChange);
      document.removeEventListener('pointerlockerror', handleLockError);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [gl, events, pointerLockAvailable, invalidate]);

  useFrame((state, dt) => {
    walkPose.x = camera.position.x;
    walkPose.z = camera.position.z;
    walkPose.yaw = yawRef.current;
    walkPose.hasPose = true;

    // A hotspot card is open — freeze the player in place so they can read it
    // and use its buttons instead of accidentally walking off while looking down
    // to click something.
    if (activeHotspotId) return;

    _euler.set(pitchRef.current, yawRef.current, 0, 'YXZ');
    camera.quaternion.setFromEuler(_euler);

    const keys = keysRef.current;
    let moveForward = 0;
    let moveRight = 0;
    if (keys.forward) moveForward += 1;
    if (keys.backward) moveForward -= 1;
    if (keys.right) moveRight += 1;
    if (keys.left) moveRight -= 1;

    if (moveForward !== 0 || moveRight !== 0) {
      const len = Math.hypot(moveForward, moveRight);
      moveForward /= len;
      moveRight /= len;

      const speed = walkDefaults.speed * (keys.sprint ? walkDefaults.sprintMultiplier : 1);
      const yaw = yawRef.current;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      // Camera-relative forward is (-sin, 0, -cos); right is (cos, 0, -sin).
      const dx = (-sin * moveForward + cos * moveRight) * speed * dt;
      const dz = (-cos * moveForward - sin * moveRight) * speed * dt;

      const [resolvedX, resolvedZ] = collision.resolveMove(
        camera.position.x,
        camera.position.z,
        camera.position.x + dx,
        camera.position.z + dz,
        camera.position.y,
        PLAYER_RADIUS,
      );
      const groundY = collision.groundHeightAt(resolvedX, resolvedZ, camera.position.y - walkDefaults.eyeHeight);
      camera.position.set(resolvedX, groundY + walkDefaults.eyeHeight, resolvedZ);
    }

    state.invalidate();
  });

  return null;
}
