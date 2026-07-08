import { useExplorerStore } from '../state/store';
import { useIsTouchOnly } from '../hooks/useIsTouchOnly';

export function ModeToggle() {
  const mode = useExplorerStore((s) => s.mode);
  const requestModeChange = useExplorerStore((s) => s.requestModeChange);
  const activate = useExplorerStore((s) => s.activate);
  const transitioning = useExplorerStore((s) => s.transitioning);
  const isTouchOnly = useIsTouchOnly();

  return (
    <div className="tse-mode-toggle" role="group" aria-label="View mode">
      <button
        type="button"
        aria-pressed={mode === 'explore'}
        disabled={transitioning}
        onClick={() => requestModeChange('explore')}
      >
        Explore
      </button>
      <button
        type="button"
        aria-pressed={mode === 'walk'}
        disabled={transitioning || isTouchOnly}
        title={isTouchOnly ? 'Walk mode needs a keyboard — try it on desktop' : undefined}
        onClick={() => {
          activate();
          requestModeChange('walk');
        }}
      >
        Walk
      </button>
    </div>
  );
}
