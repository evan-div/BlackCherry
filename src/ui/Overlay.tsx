import type { Hotspot } from '../config/types';
import { ActivationShield } from './ActivationShield';
import { ControlsLegend } from './ControlsLegend';
import { HotspotList } from './HotspotList';
import { ModeToggle } from './ModeToggle';
import { ResetButton } from './ResetButton';
import { WalkInstructions } from './WalkInstructions';

interface OverlayProps {
  hotspots: Hotspot[];
}

/** Layout shell for all non-canvas UI chrome. Kept deliberately thin — each piece of
 * chrome is its own component that reads only the store state it needs, so adding a
 * new overlay element never means touching this file's logic, just adding a slot. */
export function Overlay({ hotspots }: OverlayProps) {
  return (
    <div className="tse-overlay">
      <div className="tse-top-bar">
        <ModeToggle />
        <div className="tse-btn-group">
          <ResetButton />
        </div>
      </div>
      <div className="tse-bottom-bar">
        <ControlsLegend />
        <HotspotList hotspots={hotspots} />
      </div>
      <WalkInstructions hotspots={hotspots} />
      <ActivationShield />
    </div>
  );
}
