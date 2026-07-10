import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Vector3 } from 'three';
import { useFlyTo } from '../hooks/useFlyTo';
import { useExplorerStore } from '../state/store';
import { useSceneConfig } from '../scene/SceneConfig';

const _min = new Vector3();
const _max = new Vector3();

/** Explore mode: a damped OrbitControls instance constrained to sensible dolly/polar
 * limits plus a pan-target bounding box (OrbitControls has no built-in target bounds,
 * so we clamp it ourselves on every 'change' event). */
export function OrbitRig() {
  const ref = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate } = useThree();
  const activated = useExplorerStore((s) => s.activated);
  const onCameraCommand = useExplorerStore((s) => s.onCameraCommand);
  const { camera: cameraDefaults } = useSceneConfig();
  const bounds = cameraDefaults.targetBounds;
  const { flyTo, cancelFlyTo } = useFlyTo(ref);
  // Read via ref inside the pose effect below — `activated` there is a guard, not
  // a trigger: flipping it must never re-run the effect and yank the camera.
  const activatedRef = useRef(activated);
  activatedRef.current = activated;

  useEffect(() => {
    _min.set(...bounds.min);
    _max.set(...bounds.max);
  }, [bounds]);

  // Apply the default pose imperatively — not via a reactive `target` JSX prop,
  // which would fight a user's pan. Keyed on cameraDefaults because the defaults
  // can legitimately change after mount: a loaded model carrying authored
  // CAMERA_DEFAULT/CAMERA_TARGET empties updates SceneConfig once the GLTF
  // resolves (see SceneRoot), and the opening shot should honor them. Guarded on
  // activation so a post-engagement config change never steals the camera; on a
  // remount after walk mode, CameraTransition has already eased the camera to
  // this same pose, making the re-application a safe no-op.
  useEffect(() => {
    const controls = ref.current;
    if (!controls || activatedRef.current) return;
    camera.position.set(...cameraDefaults.position);
    controls.target.set(...cameraDefaults.target);
    controls.update();
    invalidate();
  }, [cameraDefaults, camera, invalidate]);

  useEffect(() => {
    return onCameraCommand((cmd) => {
      if (cmd.type === 'reset') {
        flyTo({ position: cameraDefaults.position, target: cameraDefaults.target });
      } else if (cmd.type === 'flyTo') {
        flyTo({ position: cmd.position, target: cmd.target });
      }
    });
  }, [flyTo, onCameraCommand, cameraDefaults]);

  const handleChange = () => {
    const controls = ref.current;
    if (!controls) return;
    const target = controls.target;
    const clamped = target.clone().clamp(_min, _max);
    if (!clamped.equals(target)) {
      target.copy(clamped);
    }
  };

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={cameraDefaults.minDistance}
      maxDistance={cameraDefaults.maxDistance}
      minPolarAngle={cameraDefaults.minPolarAngle}
      maxPolarAngle={cameraDefaults.maxPolarAngle}
      enabled={activated}
      enablePan
      enableZoom
      enableRotate
      onChange={handleChange}
      // Fires the instant the user starts a manual drag/scroll — cancels any
      // in-flight fly-to so their input takes over immediately instead of being
      // fought (and overridden) by the animation for however long it takes to
      // fully settle. See useFlyTo's cancelFlyTo for why that tail matters.
      onStart={cancelFlyTo}
    />
  );
}
