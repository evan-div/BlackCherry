import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';

interface LoadingDisplay {
  active: boolean;
  /** 0-100 clamped, or null while we've given up on numeric progress and gone indeterminate. */
  progress: number | null;
  hasErrors: boolean;
}

const INDETERMINATE_AFTER_MS = 500;

/**
 * Wraps drei's `useProgress` (backed by THREE.DefaultLoadingManager) with the
 * indeterminate fallback the plan calls for: byte-accurate progress needs a
 * Content-Length header, and for a single large GLB the loader may just jump from 0
 * to 100 with nothing in between. If progress hasn't moved in 500ms while still
 * active, we switch the caller over to an indeterminate animated bar instead of a
 * percentage that looks stuck.
 */
export function useLoadingDisplay(): LoadingDisplay {
  const { active, progress, errors } = useProgress();
  const [indeterminate, setIndeterminate] = useState(false);
  const lastValueRef = useRef(progress);
  const lastChangeRef = useRef(Date.now());

  useEffect(() => {
    if (progress !== lastValueRef.current) {
      lastValueRef.current = progress;
      lastChangeRef.current = Date.now();
      setIndeterminate(false);
    }
  }, [progress]);

  useEffect(() => {
    if (!active) {
      setIndeterminate(false);
      return;
    }
    const id = setInterval(() => {
      if (Date.now() - lastChangeRef.current >= INDETERMINATE_AFTER_MS) {
        setIndeterminate(true);
      }
    }, 150);
    return () => clearInterval(id);
  }, [active]);

  return {
    active,
    progress: indeterminate ? null : Math.min(100, Math.max(0, progress)),
    hasErrors: errors.length > 0,
  };
}
