import { VisualStage } from "./VisualStage";

const shellCues = [
  "Stream adapters connect upstream.",
  "Scores translate state into visual motion.",
  "Scenes remain abstract and replayable.",
];

export default function App() {
  return (
    <main className="app-shell" aria-label="World Instrument app shell">
      <section className="hero" aria-labelledby="app-title">
        <div className="hero__copy">
          <p className="eyebrow">World Instrument</p>
          <h1 id="app-title">A browser body for deterministic visual scores.</h1>
          <p className="lede">
            This first shell reserves the stage for generative scenes without
            exposing live streams as dashboard data.
          </p>
        </div>

        <VisualStage />
      </section>

      <section className="tuning" aria-label="Instrument readiness">
        {shellCues.map((cue) => (
          <p key={cue}>{cue}</p>
        ))}
      </section>
    </main>
  );
}
