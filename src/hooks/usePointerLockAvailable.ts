import { useEffect } from 'react';
import { useExplorerStore } from '../state/store';
import { useIsTouchOnly } from './useIsTouchOnly';

/** Feature-detects the Pointer Lock API once and mirrors it into the store so any UI
 * (legend, walk-mode toggle copy) can react to it. Touch-only devices are treated as
 * unavailable even if the API technically exists, since walk mode is disabled there. */
export function usePointerLockAvailable(): void {
  const setPointerLockAvailable = useExplorerStore((s) => s.setPointerLockAvailable);
  const isTouchOnly = useIsTouchOnly();

  useEffect(() => {
    const available = typeof document !== 'undefined' && 'pointerLockElement' in document && !isTouchOnly;
    setPointerLockAvailable(available);
  }, [isTouchOnly, setPointerLockAvailable]);
}
