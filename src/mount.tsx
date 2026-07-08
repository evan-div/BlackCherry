import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { TradeShowExplorer } from './TradeShowExplorer';
import type { ExplorerProps, ExplorerTheme } from './config/types';

export interface ExplorerHandle {
  /** Unmounts the explorer and disposes all Three.js/DOM resources. */
  unmount: () => void;
  /** Re-renders with a new theme without a full remount. */
  setTheme: (theme: ExplorerTheme) => void;
}

/**
 * Vanilla JS/non-React embed entry point — the primary integration path for a host
 * marketing site of unknown stack. React is bundled into the library build, so the
 * host needs zero framework knowledge: a container element and this one call.
 *
 *   import { mount } from '@blackcherry/trade-show-explorer';
 *   const handle = mount(document.getElementById('explorer'), { modelUrl: '/models/trade-show.glb' });
 *   // later: handle.unmount();
 */
export function mount(el: HTMLElement, options: ExplorerProps = {}): ExplorerHandle {
  const root: Root = createRoot(el);
  let currentProps = options;

  const render = () => {
    root.render(
      <StrictMode>
        <TradeShowExplorer {...currentProps} />
      </StrictMode>,
    );
  };
  render();

  return {
    unmount: () => root.unmount(),
    setTheme: (theme) => {
      currentProps = { ...currentProps, theme };
      render();
    },
  };
}
