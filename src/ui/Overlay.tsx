import type { Hotspot } from '../config/types';
import { ActivationShield } from './ActivationShield';
import { ControlsLegend } from './ControlsLegend';
import { HotspotList } from './HotspotList';
import { Minimap } from './Minimap';
import { ModeToggle } from './ModeToggle';
import { ResetButton } from './ResetButton';
import { TourButton } from './TourButton';
import { WalkInstructions } from './WalkInstructions';

interface OverlayProps {
  hotspots: Hotspot[];
  tour: { active: boolean; onStart: () => void; onStop: () => void };
  walkBounds: { min: [number, number]; max: [number, number] };
}

/** Layout shell for all non-canvas UI chrome. Kept deliberately thin — each piece of
 * chrome is its own component that reads only the store state it needs, so adding a
 * new overlay element never means touching this file's logic, just adding a slot. */
export function Overlay({ hotspots, tour, walkBounds }: OverlayProps) {
  return (
    <div className="tse-overlay">
      <div className="tse-top-bar">
        <ModeToggle />
        <div className="tse-btn-group">
          {hotspots.length > 0 && (
            <TourButton active={tour.active} onStart={tour.onStart} onStop={tour.onStop} />
          )}
          <ResetButton />
        </div>
      </div>
      <div className="tse-bottom-bar">
        <ControlsLegend />
        <HotspotList hotspots={hotspots} />
      </div>
      <WalkInstructions hotspots={hotspots} />
      <Minimap hotspots={hotspots} bounds={walkBounds} />
      <ActivationShield />
    </div>
  );
}
