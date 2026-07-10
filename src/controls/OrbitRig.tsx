import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
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
  const activated = useExplorerStore((s) => s.activated);
  const onCameraCommand = useExplorerStore((s) => s.onCameraCommand);
  const { camera: cameraDefaults } = useSceneConfig();
  const bounds = cameraDefaults.targetBounds;
  const { flyTo, cancelFlyTo } = useFlyTo(ref);

  useEffect(() => {
    _min.set(...bounds.min);
    _max.set(...bounds.max);
  }, [bounds]);

  // Set the initial orbit target imperatively, once, on mount — not via the
  // `target` JSX prop. On a fresh app load the camera already starts at
  // cameraDefaults.position/target (set declaratively on the Canvas itself), and on
  // a remount after returning from walk mode, CameraTransition has already eased
  // the camera to that same pose; imperatively nudging it again here is a safe
  // no-op either way, whereas a reactive `target` prop risks fighting a user's pan.
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    controls.target.set(...cameraDefaults.target);
    controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
