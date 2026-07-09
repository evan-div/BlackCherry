import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export interface MovementKeys {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

function emptyKeys(): MovementKeys {
  return { forward: false, backward: false, left: false, right: false, sprint: false };
}

const KEY_MAP: Record<string, keyof Omit<MovementKeys, 'sprint'>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/**
 * WASD movement key tracking, scoped to the explorer's own root element rather than
 * `window`/`document` — so an embedded instance never intercepts keystrokes meant
 * for the rest of the host page. Listeners only attach while `enabled` (walk mode +
 * activated), and the root element must actually have DOM focus for keydown to
 * reach it at all (see the mode-entry focus() call in TradeShowExplorer).
 */
export function useKeyboardMovement(
  rootRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  onEscape: () => void,
  onInteract: () => void,
): RefObject<MovementKeys> {
  const keysRef = useRef<MovementKeys>(emptyKeys());

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Stop this from also reaching the document-level "Escape deactivates"
        // listener (useDeactivationTriggers) — exiting walk mode should land back
        // in an already-activated explore mode, not re-show the click-to-explore
        // shield on top of it.
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.code === 'KeyE') {
        // Pointer lock hides and freezes the cursor, so clicking a hotspot marker
        // directly doesn't work while locked — "look at it, press E" is the
        // reliable interaction path regardless of lock state.
        onInteract();
        return;
      }
      const key = KEY_MAP[e.code];
      if (key) {
        keysRef.current[key] = true;
        e.preventDefault();
        e.stopPropagation();
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        keysRef.current.sprint = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code];
      if (key) {
        keysRef.current[key] = false;
        e.stopPropagation();
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        keysRef.current.sprint = false;
      }
    };
    const handleBlur = () => {
      keysRef.current = emptyKeys();
    };

    root.addEventListener('keydown', handleKeyDown);
    root.addEventListener('keyup', handleKeyUp);
    root.addEventListener('blur', handleBlur);
    return () => {
      root.removeEventListener('keydown', handleKeyDown);
      root.removeEventListener('keyup', handleKeyUp);
      root.removeEventListener('blur', handleBlur);
      keysRef.current = emptyKeys();
    };
  }, [enabled, rootRef, onEscape, onInteract]);

  return keysRef;
}
