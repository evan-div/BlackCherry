import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Vector3 } from 'three';
import { DEFAULT_CAMERA } from '../config/defaults';
import { useFlyTo } from '../hooks/useFlyTo';
import { useExplorerStore } from '../state/store';

const _min = new Vector3();
const _max = new Vector3();

/** Explore mode: a damped OrbitControls instance constrained to sensible dolly/polar
 * limits plus a pan-target bounding box (OrbitControls has no built-in target bounds,
 * so we clamp it ourselves on every 'change' event). */
export function OrbitRig() {
  const ref = useRef<OrbitControlsImpl>(null);
  const activated = useExplorerStore((s) => s.activated);
  const onCameraCommand = useExplorerStore((s) => s.onCameraCommand);
  const bounds = DEFAULT_CAMERA.targetBounds;
  const flyTo = useFlyTo(ref);

  useEffect(() => {
    _min.set(...bounds.min);
    _max.set(...bounds.max);
  }, [bounds]);

  // Set the initial orbit target imperatively, once, on mount — not via the
  // `target` JSX prop. On a fresh app load the camera already starts at
  // DEFAULT_CAMERA.position/target (set declaratively on the Canvas itself), and on
  // a remount after returning from walk mode, CameraTransition has already eased
  // the camera to that same pose; imperatively nudging it again here is a safe
  // no-op either way, whereas a reactive `target` prop risks fighting a user's pan.
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    controls.target.set(...DEFAULT_CAMERA.target);
    controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return onCameraCommand((cmd) => {
      if (cmd.type === 'reset') {
        flyTo({ position: DEFAULT_CAMERA.position, target: DEFAULT_CAMERA.target });
      } else if (cmd.type === 'flyTo') {
        flyTo({ position: cmd.position, target: cmd.target });
      }
    });
  }, [flyTo, onCameraCommand]);

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
      minDistance={DEFAULT_CAMERA.minDistance}
      maxDistance={DEFAULT_CAMERA.maxDistance}
      minPolarAngle={DEFAULT_CAMERA.minPolarAngle}
      maxPolarAngle={DEFAULT_CAMERA.maxPolarAngle}
      enabled={activated}
      enablePan
      enableZoom
      enableRotate
      onChange={handleChange}
    />
  );
}
