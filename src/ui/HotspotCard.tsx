import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { Hotspot } from '../config/types';
import { useExplorerStore } from '../state/store';
import { useIsTouchOnly } from '../hooks/useIsTouchOnly';

interface HotspotCardProps {
  hotspots: Hotspot[];
  /** Positioned imperatively every frame by Hotspots' projector (see hotspots/Hotspots.tsx)
   * — kept out of React state so camera movement never triggers a re-render here. */
  anchorRef: RefObject<HTMLDivElement | null>;
  onSelect?: (id: string | null) => void;
  onCtaClick?: (hotspotId: string, ctaUrl: string) => void;
}

/**
 * The single expanded info card for whichever hotspot is active. On touch-only
 * devices it renders as a bottom sheet instead (no projection needed — see
 * .tse-bottom-sheet / the max-width:640px override in styles.css), since a
 * screen-projected card is awkward to hit-test and read on small screens.
 */
export function HotspotCard({ hotspots, anchorRef, onSelect, onCtaClick }: HotspotCardProps) {
  const activeId = useExplorerStore((s) => s.activeHotspotId);
  const selectHotspot = useExplorerStore((s) => s.selectHotspot);
  const isWalking = useExplorerStore((s) => s.mode === 'walk');
  const isTouchOnly = useIsTouchOnly();
  const hotspot = hotspots.find((h) => h.id === activeId) ?? null;

  useEffect(() => {
    onSelect?.(activeId);
  }, [activeId, onSelect]);

  const close = () => selectHotspot(null);

  if (!hotspot) return null;

  const className = [
    'tse-hotspot-card',
    // Touch devices get the bottom sheet; walk mode pins the card to the middle-left
    // of the viewport (see styles.css) instead of projecting it onto the hotspot.
    isTouchOnly ? 'tse-bottom-sheet' : '',
    isWalking && !isTouchOnly ? 'tse-hotspot-card--walk' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={anchorRef}
      className={className}
      role="dialog"
      aria-labelledby={`tse-hotspot-title-${hotspot.id}`}
    >
      <button type="button" className="tse-hotspot-card__close" aria-label="Close" onClick={close}>
        ×
      </button>
      {hotspot.category && <div className="tse-hotspot-card__category">{hotspot.category}</div>}
      <h3 id={`tse-hotspot-title-${hotspot.id}`} className="tse-hotspot-card__title">
        {hotspot.title}
      </h3>
      {/* Always render a photo area: the real image when one is configured, otherwise
       * a labelled placeholder so it's clear a real-life photo belongs here. */}
      {hotspot.image ? (
        <img src={hotspot.image} alt="" />
      ) : (
        <div className="tse-hotspot-card__photo-placeholder" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.6" />
            <path d="M4 17l4.5-4.5 3.5 3.5 3-3L20 16" />
          </svg>
          <span>Photo coming soon</span>
        </div>
      )}
      <p className="tse-hotspot-card__desc">{hotspot.description}</p>
      {hotspot.ctaUrl && (
        <a
          href={hotspot.ctaUrl}
          className="tse-btn tse-btn--accent"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onCtaClick?.(hotspot.id, hotspot.ctaUrl!)}
        >
          {hotspot.ctaLabel ?? 'Learn more'}
        </a>
      )}
    </div>
  );
}
