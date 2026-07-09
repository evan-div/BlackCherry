import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { CAMERA_TRANSITION_SECONDS } from '../config/defaults';
import { useExplorerStore } from '../state/store';
import { useSceneConfig } from '../scene/SceneConfig';
import { createCollisionWorld } from './collision';

const _euler = new Euler(0, 0, 0, 'YXZ');
const _lookMatrix = new Matrix4();

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Owns the camera exclusively while `transitioning` is true, easing it from
 * wherever it currently is to the destination mode's pose rather than snapping —
 * explore→walk drops to eye height above the ground at the current look point;
 * walk→explore returns to the default presentation pose. Runs once per mode
 * switch: ControlsRig mounts a fresh instance of this component each time, so the
 * mount-time setup effect intentionally has no reactive dependencies.
 */
export function CameraTransition() {
  const { camera, scene } = useThree();
  const mode = useExplorerStore((s) => s.mode);
  const setTransitioning = useExplorerStore((s) => s.setTransitioning);
  const { camera: cameraDefaults, walk: walkDefaults } = useSceneConfig();
  const collision = useMemo(() => createCollisionWorld(scene, walkDefaults), [scene, walkDefaults]);

  const startPos = useRef(new Vector3());
  const startQuat = useRef(new Quaternion());
  const goalPos = useRef(new Vector3());
  const goalQuat = useRef(new Quaternion());
  const elapsed = useRef(0);

  useEffect(() => {
    startPos.current.copy(camera.position);
    startQuat.current.copy(camera.quaternion);
    elapsed.current = 0;

    if (mode === 'walk') {
      const groundY = collision.groundHeightAt(camera.position.x, camera.position.z, 0);
      goalPos.current.set(camera.position.x, groundY + walkDefaults.eyeHeight, camera.position.z);
      // Keep current facing but level out pitch/roll for a natural walk start.
      _euler.setFromQuaternion(camera.quaternion, 'YXZ');
      _euler.x = 0;
      _euler.z = 0;
      goalQuat.current.setFromEuler(_euler);
    } else {
      goalPos.current.set(...cameraDefaults.position);
      _lookMatrix.lookAt(goalPos.current, new Vector3(...cameraDefaults.target), camera.up);
      goalQuat.current.setFromRotationMatrix(_lookMatrix);
    }
    // Mount-only: this component is remounted fresh on every mode switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, dt) => {
    elapsed.current += dt;
    const t = Math.min(elapsed.current / CAMERA_TRANSITION_SECONDS, 1);
    const eased = smoothstep(t);
    camera.position.lerpVectors(startPos.current, goalPos.current, eased);
    camera.quaternion.slerpQuaternions(startQuat.current, goalQuat.current, eased);
    state.invalidate();
    if (t >= 1) setTransitioning(false);
  });

  return null;
}
