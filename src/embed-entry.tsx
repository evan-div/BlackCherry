import { mount } from './mount';
import type { ExplorerProps } from './config/types';

/**
 * Entry point for embed.html — the zero-effort `<iframe src="embed.html?...">`
 * fallback for host sites that can't/won't run the npm package directly. Config is
 * read from query params rather than a full JSON blob to keep a plain iframe embed
 * copy-pasteable.
 */
const params = new URLSearchParams(window.location.search);

const props: ExplorerProps = {
  modelUrl: params.get('modelUrl') ?? undefined,
  height: 'fill',
  defaultMode: params.get('mode') === 'walk' ? 'walk' : 'explore',
};

const accent = params.get('accent');
if (accent) {
  props.theme = { accent: `#${accent.replace(/^#/, '')}` };
}

const container = document.getElementById('embed-root');
if (container) {
  mount(container, props);
}
