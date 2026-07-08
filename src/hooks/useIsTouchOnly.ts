import { useEffect, useState } from 'react';

function computeIsTouchOnly(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const canHover = window.matchMedia('(any-hover: hover)').matches;
  return coarse && !canHover;
}

/** True for touch-only devices (phones/tablets); false for desktop and hybrid
 * devices that have a hover-capable pointer (trackpad/mouse) alongside touch. */
export function useIsTouchOnly(): boolean {
  const [isTouchOnly, setIsTouchOnly] = useState(computeIsTouchOnly);

  useEffect(() => {
    const coarseQuery = window.matchMedia('(pointer: coarse)');
    const hoverQuery = window.matchMedia('(any-hover: hover)');
    const update = () => setIsTouchOnly(computeIsTouchOnly());
    coarseQuery.addEventListener('change', update);
    hoverQuery.addEventListener('change', update);
    return () => {
      coarseQuery.removeEventListener('change', update);
      hoverQuery.removeEventListener('change', update);
    };
  }, []);

  return isTouchOnly;
}
