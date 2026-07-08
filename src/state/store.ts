import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { ExplorerState } from './createExplorerStore';

export type { ExplorerState, CameraCommand } from './createExplorerStore';

export const ExplorerStoreContext = createContext<StoreApi<ExplorerState> | null>(null);

/** Reads from the nearest `<TradeShowExplorer>`'s own store instance. Must be used
 * inside the component tree TradeShowExplorer renders (it provides the context). */
export function useExplorerStore<T>(selector: (state: ExplorerState) => T): T {
  const store = useContext(ExplorerStoreContext);
  if (!store) {
    throw new Error('useExplorerStore must be used within a <TradeShowExplorer>');
  }
  return useStore(store, selector);
}
