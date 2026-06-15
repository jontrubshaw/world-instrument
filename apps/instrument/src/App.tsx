import { useEffect, useState } from 'react';

import { InstrumentStage } from './components/InstrumentStage.tsx';
import {
  DEFAULT_INSTRUMENT_SCENE,
  loadWeatherInstrumentState,
  type WeatherInstrumentState,
} from './weatherInstrument.ts';

export function App() {
  const [instrumentState, setInstrumentState] = useState<WeatherInstrumentState>();

  useEffect(() => {
    let cancelled = false;

    void loadWeatherInstrumentState().then((state) => {
      if (!cancelled) {
        setInstrumentState(state);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const visual = instrumentState?.visual ?? DEFAULT_INSTRUMENT_SCENE;
  const observedLabel =
    instrumentState === undefined
      ? 'loading fixture score'
      : `fixture observed ${formatObservedAt(instrumentState.observedAt)}`;

  return (
    <main className="instrument-shell" aria-labelledby="instrument-title">
      <section className="stage-panel" aria-label="Live instrument surface">
        <InstrumentStage visual={visual} />
        <div className="stage-glow" aria-hidden="true" />
      </section>

      <section className="voice-panel">
        <p className="eyebrow">World Instrument / weather score</p>
        <h1 id="instrument-title">Weather is tuning the surface.</h1>
        <p className="lead">
          A recorded London weather stream is replayed through the adapter and Weather Score v1,
          pressing deterministic light, motion, and tension into the visual instrument.
        </p>
        <dl className="score-readout" aria-label="Current score voice">
          <div>
            <dt>source</dt>
            <dd>{instrumentState?.label ?? 'weather fixture'}</dd>
          </div>
          <div>
            <dt>condition</dt>
            <dd>{visual.condition}</dd>
          </div>
          <div>
            <dt>trace</dt>
            <dd>{visual.inputHash}</dd>
          </div>
          <div>
            <dt>time</dt>
            <dd>{observedLabel}</dd>
          </div>
        </dl>
        <div className="signal-strip" aria-label="Prepared output lanes">
          <span>visual score</span>
          <span>{visual.streamStatus}</span>
          <span>{visual.palette.body}</span>
        </div>
      </section>
    </main>
  );
}

function formatObservedAt(observedAt: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(observedAt));
}
