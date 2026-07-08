import type { RefObject } from 'react';
import { useExplorerStore } from '../state/store';
import { OrbitRig } from './OrbitRig';
import { WalkRig } from './WalkRig';
import { CameraTransition } from './CameraTransition';
import type { MovementKeys } from './useKeyboard';

interface ControlsRigProps {
  keysRef: RefObject<MovementKeys>;
}

/** Mode switchboard: exactly one rig owns the camera at a time. Rigs unmount
 * cleanly (drei's OrbitControls disposes its own listeners; WalkRig removes its
 * own), so there's never a period where two rigs both hold input listeners. */
export function ControlsRig({ keysRef }: ControlsRigProps) {
  const mode = useExplorerStore((s) => s.mode);
  const transitioning = useExplorerStore((s) => s.transitioning);

  if (transitioning) return <CameraTransition />;
  return mode === 'walk' ? <WalkRig keysRef={keysRef} /> : <OrbitRig />;
}
