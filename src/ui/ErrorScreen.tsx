import { useExplorerStore } from '../state/store';

interface ErrorScreenProps {
  onRetry: () => void;
}

export function ErrorScreen({ onRetry }: ErrorScreenProps) {
  const error = useExplorerStore((s) => s.error);
  if (!error) return null;

  return (
    <div className="tse-error" role="alert">
      <div className="tse-error__title">The 3D experience couldn&apos;t load</div>
      <p className="tse-error__body">{error}</p>
      <button type="button" className="tse-btn tse-btn--accent" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
