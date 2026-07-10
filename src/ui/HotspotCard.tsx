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
  const isTouchOnly = useIsTouchOnly();
  const hotspot = hotspots.find((h) => h.id === activeId) ?? null;

  useEffect(() => {
    onSelect?.(activeId);
  }, [activeId, onSelect]);

  const close = () => selectHotspot(null);

  if (!hotspot) return null;

  return (
    <div
      ref={anchorRef}
      className={isTouchOnly ? 'tse-hotspot-card tse-bottom-sheet' : 'tse-hotspot-card'}
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
      {hotspot.image && <img src={hotspot.image} alt="" />}
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
