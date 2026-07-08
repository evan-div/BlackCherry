import { useEffect, useState } from 'react';
import { useLoadingDisplay } from '../loaders/progress';
import { useExplorerStore } from '../state/store';

const FADE_MS = 300;

/** Mirrors the reference site's "LOADING BOOTH 0%" pattern. Stays mounted briefly
 * after loading finishes so the CSS opacity transition can play instead of popping. */
export function LoadingScreen() {
  const storeActive = useExplorerStore((s) => s.loading.active);
  const error = useExplorerStore((s) => s.error);
  const { progress } = useLoadingDisplay();
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (!storeActive) {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), FADE_MS);
      return () => clearTimeout(t);
    }
    setVisible(true);
    setMounted(true);
  }, [storeActive]);

  if (!mounted || error) return null;

  return (
    <div className="tse-loading" style={{ opacity: visible ? 1 : 0 }} aria-live="polite">
      <div className="tse-loading__label">
        Loading show floor{progress !== null ? ` ${Math.floor(progress)}%` : '…'}
      </div>
      <div className="tse-progress-track">
        <div
          className={`tse-progress-fill${progress === null ? ' tse-progress-fill--indeterminate' : ''}`}
          style={progress !== null ? { width: `${progress}%` } : undefined}
        />
      </div>
    </div>
  );
}
