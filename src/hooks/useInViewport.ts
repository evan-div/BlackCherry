import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * One-shot viewport proximity check: flips to `true` once the element has come
 * within `rootMargin` of the viewport, then stops observing (the heavy 3D chunk
 * this gates should mount once and stay mounted, not toggle on scroll). Used to
 * defer loading three.js/react-three-fiber until the explorer is actually about to
 * be seen, rather than the moment the host page's script runs.
 */
export function useInViewport<T extends Element>(
  ref: RefObject<T | null>,
  rootMargin = '400px',
): boolean {
  const [inViewport, setInViewport] = useState(false);

  useEffect(() => {
    if (inViewport) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      // No IO support — fail open rather than never mounting the explorer.
      setInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin, inViewport]);

  return inViewport;
}
