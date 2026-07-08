import { TradeShowExplorer } from '../TradeShowExplorer';
import './demo.css';

/**
 * Simulates a real marketing page with the explorer embedded mid-scroll, so we can
 * verify it never hijacks page scroll, sizes responsively, and behaves like a real
 * embedded widget rather than a full-viewport app.
 */
export function DemoApp() {
  return (
    <main className="demo-page">
      <header className="demo-hero">
        <h1>BlackCherry Trade Show Explorer</h1>
        <p>Scroll down to reach the interactive 3D booth environment.</p>
      </header>

      <section className="demo-filler">
        <p>Placeholder marketing copy above the fold, to prove the explorer lazy-mounts
          only once scrolled near, and that normal page scroll is unaffected above it.</p>
      </section>

      <section className="demo-explorer-section">
        <h2>Explore the Show Floor</h2>
        <TradeShowExplorer aspect={16 / 9} />
      </section>

      <section className="demo-filler">
        <p>Placeholder marketing copy below the fold, to confirm scrolling past the
          explorer releases it cleanly.</p>
      </section>
    </main>
  );
}
