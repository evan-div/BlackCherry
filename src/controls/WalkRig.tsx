import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, MathUtils } from 'three';
import { DEFAULT_WALK } from '../config/defaults';
import { useExplorerStore } from '../state/store';
import { createCollisionWorld } from './collision';
import type { MovementKeys } from './useKeyboard';

interface WalkRigProps {
  keysRef: RefObject<MovementKeys>;
}

const PITCH_LIMIT = Math.PI / 2 - 0.05;
const LOOK_SENSITIVITY = 0.0025;
const _euler = new Euler(0, 0, 0, 'YXZ');

/**
 * First-person walk mode. Look is driven by pointer lock when available, with a
 * drag-to-look fallback for browsers without the Pointer Lock API (notably iOS
 * Safari) or when the user denies/loses the lock — falling back rather than
 * exiting walk mode outright, so the user is never stuck. Movement integrates
 * WASD against the lightweight collision world (ground height + XZ bounds).
 */
export function WalkRig({ keysRef }: WalkRigProps) {
  const { camera, gl, scene } = useThree();
  const pointerLockAvailable = useExplorerStore((s) => s.pointerLockAvailable);
  const collision = useMemo(() => createCollisionWorld(scene), [scene]);

  const lockedRef = useRef(false);
  const draggingRef = useRef(false);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);

  // Pick up wherever CameraTransition left the camera (position + facing).
  useEffect(() => {
    _euler.setFromQuaternion(camera.quaternion, 'YXZ');
    yawRef.current = _euler.y;
    pitchRef.current = MathUtils.clamp(_euler.x, -PITCH_LIMIT, PITCH_LIMIT);
  }, [camera]);

  useEffect(() => {
    const canvas = gl.domElement;

    const applyLook = (dx: number, dy: number) => {
      yawRef.current -= dx * LOOK_SENSITIVITY;
      pitchRef.current = MathUtils.clamp(pitchRef.current - dy * LOOK_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (lockedRef.current || draggingRef.current) applyLook(e.movementX, e.movementY);
    };
    const handlePointerDown = () => {
      if (pointerLockAvailable) {
        canvas.requestPointerLock();
      } else {
        draggingRef.current = true;
      }
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

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handleLockChange);
    document.addEventListener('pointerlockerror', handleLockError);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handleLockChange);
      document.removeEventListener('pointerlockerror', handleLockError);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [gl, pointerLockAvailable]);

  useFrame((state, dt) => {
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

      const speed = DEFAULT_WALK.speed * (keys.sprint ? DEFAULT_WALK.sprintMultiplier : 1);
      const yaw = yawRef.current;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      // Camera-relative forward is (-sin, 0, -cos); right is (cos, 0, -sin).
      const dx = (-sin * moveForward + cos * moveRight) * speed * dt;
      const dz = (-cos * moveForward - sin * moveRight) * speed * dt;

      const [clampedX, clampedZ] = collision.clampXZ(camera.position.x + dx, camera.position.z + dz);
      const groundY = collision.groundHeightAt(clampedX, clampedZ, camera.position.y - DEFAULT_WALK.eyeHeight);
      camera.position.set(clampedX, groundY + DEFAULT_WALK.eyeHeight, clampedZ);
    }

    state.invalidate();
  });

  return null;
}
