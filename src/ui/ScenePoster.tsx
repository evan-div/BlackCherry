interface ScenePosterProps {
  posterUrl?: string;
}

/**
 * Lightweight, three.js-free placeholder shown before the 3D chunk has mounted —
 * either because it's not in the viewport yet (lazy="viewport", the default) or
 * because the lazy-loaded chunk itself is still downloading (Suspense fallback).
 * Deliberately has no dependency on drei/three so it never pulls the heavy bundle
 * in just to render a "please wait" state.
 */
export function ScenePoster({ posterUrl }: ScenePosterProps) {
  if (posterUrl) {
    return <img className="tse-poster" src={posterUrl} alt="" />;
  }
  return (
    <div className="tse-poster tse-poster--blank" aria-hidden="true">
      <div className="tse-poster__pulse" />
    </div>
  );
}
