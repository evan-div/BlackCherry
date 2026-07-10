import { useCallback, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { damp3 } from 'maath/easing';

interface FlyToTarget {
  position: [number, number, number];
  target: [number, number, number];
}

const _goalPos = new Vector3();
const _goalTarget = new Vector3();

/** Smoothly tweens the camera + OrbitControls target toward a goal pose using
 * exponential damping (frame-rate independent). Used by the reset button and
 * hotspot-list "fly to" navigation. Must only be used while OrbitRig is mounted. */
export function useFlyTo(controlsRef: React.RefObject<OrbitControlsImpl | null>) {
  const { invalidate } = useThree();
  const goal = useRef<FlyToTarget | null>(null);

  useFrame((state, dt) => {
    const controls = controlsRef.current;
    const g = goal.current;
    if (!controls || !g) return;

    _goalPos.set(...g.position);
    _goalTarget.set(...g.target);
    damp3(state.camera.position, _goalPos, 0.35, dt);
    damp3(controls.target, _goalTarget, 0.35, dt);
    controls.update();
    invalidate();

    const posDist = state.camera.position.distanceTo(_goalPos);
    const targetDist = controls.target.distanceTo(_goalTarget);
    if (posDist <= 0.01 && targetDist <= 0.01) {
      goal.current = null;
    }
  });

  const flyTo = useCallback((target: FlyToTarget) => {
    goal.current = target;
    invalidate();
  }, [invalidate]);

  // The damp-toward-goal loop above keeps overriding camera.position/controls.target
  // every frame for as long as `goal` is set — including for a couple of seconds
  // after a fly-to *looks* finished, since closing the last fraction of a percent
  // of distance under exponential damping takes a while. Without this, a user who
  // starts dragging to orbit/pan during that tail end gets fought frame-by-frame
  // and snapped back toward the hotspot, unable to look away. OrbitRig wires this
  // to the controls' own 'start' event, which fires the instant a drag begins.
  const cancelFlyTo = useCallback(() => {
    goal.current = null;
  }, []);

  return { flyTo, cancelFlyTo };
}
