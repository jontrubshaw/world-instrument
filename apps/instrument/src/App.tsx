import { InstrumentStage } from './components/InstrumentStage.tsx';

export function App() {
  return (
    <main className="instrument-shell" aria-labelledby="instrument-title">
      <section className="stage-panel" aria-label="Live instrument surface">
        <InstrumentStage />
        <div className="stage-glow" aria-hidden="true" />
      </section>

      <section className="voice-panel">
        <p className="eyebrow">World Instrument / app shell</p>
        <h1 id="instrument-title">A tuned surface for live streams.</h1>
        <p className="lead">
          The first browser body is ready for deterministic scores to press light, motion, sound,
          and haptics into one abstract instrument.
        </p>
        <div className="signal-strip" aria-label="Prepared output lanes">
          <span>visual</span>
          <span>sonic</span>
          <span>haptic</span>
        </div>
      </section>
    </main>
  );
}
