/** Where a hotspot sits in the scene. Prefer `node` — it survives model re-exports;
 * `position` is a fallback for scenes without authored anchor Empties. A node anchor
 * may carry its own `fallbackPosition`, used when the named node isn't in the scene
 * (yet) — this lets configs be written against the export contract's `HS_<id>`
 * empties before the asset actually ships them. */
export type HotspotAnchor =
  | {
      type: 'node';
      nodeName: string;
      offset?: [number, number, number];
      fallbackPosition?: [number, number, number];
    }
  | { type: 'position'; position: [number, number, number] };

export type HotspotCategory =
  | 'product'
  | 'signage'
  | 'furniture'
  | 'av'
  | 'decor'
  | (string & {});

export interface HotspotCameraView {
  /** Explicit camera position to fly to. If omitted, one is derived by backing off from the anchor. */
  position?: [number, number, number];
  /** Orbit distance to use when focusing this hotspot (meters). */
  distance?: number;
}

export interface Hotspot {
  /** Stable, unique, kebab-case. */
  id: string;
  anchor: HotspotAnchor;
  title: string;
  description: string;
  image?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  /** When true, the card's CTA opens an inline lead-capture form (name/email/
   * message) instead of linking out — routed to the host's `onLeadSubmit`. The
   * button label still comes from `ctaLabel` (default "Request a quote"). Requires
   * `onLeadSubmit` to be wired, otherwise it falls back to the link CTA. */
  leadCapture?: boolean;
  category?: HotspotCategory;
  cameraView?: HotspotCameraView;
}

/** A lead captured from a hotspot's inline CTA form, handed to the host's
 * `onLeadSubmit` to route into their CRM / webhook / email. */
export interface HotspotLead {
  hotspotId: string;
  name: string;
  email: string;
  message?: string;
}

export interface ExplorerTheme {
  accent?: string;
  accentText?: string;
  surface?: string;
  surfaceText?: string;
  fontFamily?: string;
  radius?: string;
  overlayScrim?: string;
}

export type ExplorerMode = 'explore' | 'walk';

/**
 * Discrete interaction events for host-page analytics (GA/Segment/etc.).
 * Deliberately a closed union — hosts can exhaustively switch on `type`,
 * and adding a variant is an API change reviewers will see.
 */
export type ExplorerAnalyticsEvent =
  | { type: 'activated' }
  | { type: 'mode_changed'; mode: ExplorerMode }
  | { type: 'hotspot_opened'; hotspotId: string }
  | { type: 'hotspot_closed'; hotspotId: string }
  | { type: 'cta_clicked'; hotspotId: string; ctaUrl: string }
  | { type: 'lead_submitted'; hotspotId: string }
  | { type: 'tour_started' }
  | { type: 'tour_ended'; reason: 'completed' | 'user_input' | 'stopped' };

export interface Vec3Tuple extends Array<number> {
  0: number;
  1: number;
  2: number;
}

export interface CameraDefaults {
  position: [number, number, number];
  target: [number, number, number];
  minDistance: number;
  maxDistance: number;
  /** Radians. 0 = straight down, PI = straight up. */
  minPolarAngle: number;
  maxPolarAngle: number;
  /** Axis-aligned box clamping where the orbit target may be panned to. */
  targetBounds: { min: [number, number, number]; max: [number, number, number] };
}

export interface WalkDefaults {
  eyeHeight: number;
  speed: number;
  sprintMultiplier: number;
  /** Capsule radius used for wall clearance. */
  radius: number;
  /** Hard XZ fallback clamp, used when no COLLISION mesh is present. */
  bounds: { min: [number, number]; max: [number, number] };
}

export interface ExplorerProps {
  modelUrl?: string;
  hotspots?: Hotspot[];
  theme?: ExplorerTheme;
  defaultMode?: ExplorerMode;
  /** Aspect ratio (width / height) used to size the component when no explicit height is given. */
  aspect?: number;
  /** Explicit height (CSS value) or 'fill' to take 100% of the parent's height. */
  height?: string | 'fill';
  decoderPath?: string;
  ktx2Path?: string;
  /** 'viewport' (default) mounts the heavy 3D chunk only once scrolled near; 'eager' mounts immediately. */
  lazy?: 'viewport' | 'eager';
  posterUrl?: string;
  onHotspotSelect?: (id: string | null) => void;
  onModeChange?: (mode: ExplorerMode) => void;
  /** Fired on discrete user interactions (hotspot opened, CTA clicked, mode
   * switched…) so the host page can forward them to its analytics stack. */
  onAnalyticsEvent?: (event: ExplorerAnalyticsEvent) => void;
  /** Receives leads captured from hotspots flagged `leadCapture` — route to your
   * CRM/webhook. Return a promise to keep the form in its submitting state until
   * it resolves; throw/reject to surface an error and let the user retry. */
  onLeadSubmit?: (lead: HotspotLead) => void | Promise<void>;
  /** Opt-in shareable deep-links. When true, the explorer reads `?tse_hotspot=<id>`
   * and `?tse_mode=walk` from the page URL on load (auto-activating and opening that
   * hotspot / entering walk mode), and keeps those params in sync as the user
   * navigates — so a copied URL reopens the same view. Namespaced params, written
   * via replaceState. Use on a SINGLE explorer per page (multiple instances would
   * fight over the shared URL); off by default. */
  deepLink?: boolean;
}
