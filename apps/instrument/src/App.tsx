import { useEffect, useState, type CSSProperties } from 'react';

import { InstrumentStage } from './components/InstrumentStage.tsx';
import { DEFAULT_VISUAL_PARAMETERS, type InstrumentVisualParameters } from './visualParameters.ts';
import { loadFixtureWeatherInstrumentState } from './weatherInstrument.ts';

interface InstrumentViewState {
  readonly visualParameters: InstrumentVisualParameters;
  readonly sourceLabel: string;
  readonly statusLabel: string;
}

const INITIAL_VIEW_STATE: InstrumentViewState = {
  visualParameters: DEFAULT_VISUAL_PARAMETERS,
  sourceLabel: 'Recorded weather fixture',
  statusLabel: 'tuning fixture replay',
};

export function App() {
  const [viewState, setViewState] = useState<InstrumentViewState>(INITIAL_VIEW_STATE);
  const stageGlowStyle = {
    '--stage-glow-color': viewState.visualParameters.accentColor,
    '--stage-glow-opacity': String(viewState.visualParameters.glowOpacity),
  } as CSSProperties;

  useEffect(() => {
    let active = true;

    void loadFixtureWeatherInstrumentState().then((state) => {
      if (!active) {
        return;
      }

      setViewState({
        ...state,
        statusLabel: `${state.visualParameters.condition} score replay`,
      });
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="instrument-shell" aria-labelledby="instrument-title">
      <section className="stage-panel" aria-label="Live instrument surface">
        <InstrumentStage visualParameters={viewState.visualParameters} />
        <div className="stage-glow" style={stageGlowStyle} aria-hidden="true" />
      </section>

      <section className="voice-panel">
        <p className="eyebrow">World Instrument / weather score</p>
        <h1 id="instrument-title">A weather score tuned into light.</h1>
        <p className="lead">
          A recorded stream is replayed through the first deterministic weather score, pressing
          palette, pulse, motion, and atmosphere directly into the visual instrument.
        </p>
        <div className="signal-strip" aria-label="Score-driven output lanes">
          <span>{viewState.sourceLabel}</span>
          <span>{viewState.statusLabel}</span>
          <span>visual signature {viewState.visualParameters.signature}</span>
        </div>
      </section>
    </main>
  );
}
