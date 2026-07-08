import { useExplorerStore } from '../state/store';

export function ResetButton() {
  const requestReset = useExplorerStore((s) => s.requestReset);
  const mode = useExplorerStore((s) => s.mode);

  return (
    <button
      type="button"
      className="tse-btn tse-btn--icon"
      onClick={requestReset}
      title="Reset camera"
      aria-label="Reset camera to the default view"
      disabled={mode === 'walk'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 4v6h6M20 20v-6h-6M4.5 15a8 8 0 0 0 14.6 2.5M19.5 9A8 8 0 0 0 4.9 6.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
