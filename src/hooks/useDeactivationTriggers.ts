import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useExplorerStore } from '../state/store';

/**
 * Wires the ways the click-to-activate gate closes again: a pointerdown outside the
 * component, or Escape while in explore mode (Escape in walk mode is handled by
 * WalkRig itself, which exits to explore rather than deactivating outright).
 */
export function useDeactivationTriggers(rootRef: RefObject<HTMLElement | null>) {
  const activated = useExplorerStore((s) => s.activated);
  const mode = useExplorerStore((s) => s.mode);
  const deactivate = useExplorerStore((s) => s.deactivate);

  useEffect(() => {
    if (!activated) return;

    const handlePointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (root && e.target instanceof Node && !root.contains(e.target)) {
        deactivate();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode === 'explore') {
        deactivate();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activated, mode, deactivate, rootRef]);
}
