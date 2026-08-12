import { useState } from 'react';
import type { Hotspot, HotspotLead } from '../config/types';
import { LeadForm } from './LeadForm';

interface MobileFallbackProps {
  hotspots: Hotspot[];
  posterUrl?: string;
  onCtaClick?: (hotspotId: string, ctaUrl: string) => void;
  onLeadSubmit?: (lead: HotspotLead) => void | Promise<void>;
}

/**
 * Shown instead of the 3D explorer when `desktopOnly` is set and the visitor is on a
 * touch-only device.
 *
 * The point is NOT to show a "come back on desktop" dead end. Mobile is typically a
 * large share of traffic on a marketing page, so this keeps everything that actually
 * drives leads — the venue photo, every space with its description, and the working
 * CTA / lead form — and drops only the part that needs a real GPU. A visitor can still
 * read about the venue and request a quote from their phone; they just do it from a
 * list rather than by walking the room.
 *
 * It also never mounts the Canvas or imports the three.js chunk, so phones pay nothing
 * for the 3D bundle or the model download.
 */
export function MobileFallback({ hotspots, posterUrl, onCtaClick, onLeadSubmit }: MobileFallbackProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="tse-mobile">
      <div className="tse-mobile__hero">
        {posterUrl ? (
          <img className="tse-mobile__poster" src={posterUrl} alt="The venue" />
        ) : (
          <div className="tse-mobile__poster tse-mobile__poster--blank" aria-hidden="true" />
        )}
        <div className="tse-mobile__hero-copy">
          <span className="tse-mobile__badge">Interactive 3D tour</span>
          <p className="tse-mobile__note">
            Walk through the full venue in 3D on a desktop browser. Browse the spaces below
            in the meantime.
          </p>
        </div>
      </div>

      <ul className="tse-mobile__list">
        {hotspots.map((hotspot) => {
          const open = openId === hotspot.id;
          return (
            <li key={hotspot.id} className="tse-mobile__item">
              <button
                type="button"
                className="tse-mobile__item-header"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : hotspot.id)}
              >
                <span>
                  {hotspot.category && (
                    <span className="tse-mobile__category">{hotspot.category}</span>
                  )}
                  <span className="tse-mobile__title">{hotspot.title}</span>
                </span>
                <span className={`tse-mobile__chevron${open ? ' tse-mobile__chevron--open' : ''}`} aria-hidden="true">
                  ›
                </span>
              </button>
              {open && (
                <div className="tse-mobile__body">
                  {hotspot.image ? (
                    <img className="tse-mobile__photo" src={hotspot.image} alt="" />
                  ) : (
                    <div className="tse-mobile__photo tse-mobile__photo--placeholder" aria-hidden="true">
                      Photo coming soon
                    </div>
                  )}
                  <p className="tse-mobile__desc">{hotspot.description}</p>
                  {hotspot.leadCapture && onLeadSubmit ? (
                    <LeadForm
                      hotspotId={hotspot.id}
                      label={hotspot.ctaLabel ?? 'Request a quote'}
                      onSubmit={onLeadSubmit}
                    />
                  ) : (
                    hotspot.ctaUrl && (
                      <a
                        href={hotspot.ctaUrl}
                        className="tse-btn tse-btn--accent"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onCtaClick?.(hotspot.id, hotspot.ctaUrl!)}
                      >
                        {hotspot.ctaLabel ?? 'Learn more'}
                      </a>
                    )
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
