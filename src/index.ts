/** Public library entry. See README for embedding instructions. */
export { TradeShowExplorer } from './TradeShowExplorer';
export { mount } from './mount';
export type { ExplorerHandle } from './mount';
export type {
  ExplorerProps,
  ExplorerTheme,
  ExplorerMode,
  Hotspot,
  HotspotAnchor,
  HotspotCameraView,
  HotspotCategory,
} from './config/types';
export { hotspots as defaultHotspots } from './config/hotspots';
