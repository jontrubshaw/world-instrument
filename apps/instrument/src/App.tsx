import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { InstrumentStage } from './components/InstrumentStage.tsx';
import {
  REPLAY_PLAYBACK_INTERVAL_MS,
  evaluateReplayFrame,
  loadReplayArchives,
} from './replayArchive.ts';

export function App() {
  const [archives] = useState(() => loadReplayArchives());
  const [archiveId, setArchiveId] = useState(archives[0]?.id ?? '');
  const [framePosition, setFramePosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeArchive = archives.find((archive) => archive.id === archiveId) ?? archives[0];

  const viewState = useMemo(() => {
    if (activeArchive === undefined) {
      throw new Error('Expected at least one replay archive.');
    }

    return evaluateReplayFrame(activeArchive, framePosition);
  }, [activeArchive, framePosition]);
  const lastFramePosition = viewState.frameCount - 1;
  const stageGlowStyle = {
    '--stage-glow-color': viewState.visualParameters.accentColor,
    '--stage-glow-opacity': String(viewState.visualParameters.glowOpacity),
  } as CSSProperties;

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setFramePosition((currentPosition) => {
        if (currentPosition >= lastFramePosition) {
          setIsPlaying(false);

          return currentPosition;
        }

        return currentPosition + 1;
      });
    }, REPLAY_PLAYBACK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPlaying, lastFramePosition]);

  const selectArchive = (nextArchiveId: string) => {
    setArchiveId(nextArchiveId);
    setFramePosition(0);
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    if (framePosition >= lastFramePosition) {
      setFramePosition(0);
    }

    setIsPlaying(true);
  };

  const restartReplay = () => {
    setFramePosition(0);
    setIsPlaying(false);
  };

  const stepReplay = (direction: -1 | 1) => {
    setIsPlaying(false);
    setFramePosition((currentPosition) =>
      Math.min(Math.max(currentPosition + direction, 0), lastFramePosition),
    );
  };

  const scrubReplay = (nextPosition: number) => {
    setIsPlaying(false);
    setFramePosition(nextPosition);
  };

  return (
    <main className="instrument-shell" aria-labelledby="instrument-title">
      <section className="stage-panel" aria-label="Instrument surface">
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
        <section className="replay-controls" aria-label="Replay controls">
          <label className="archive-picker">
            <span>Archive</span>
            <select value={archiveId} onChange={(event) => selectArchive(event.target.value)}>
              {archives.map((archive) => (
                <option value={archive.id} key={archive.id}>
                  {archive.label}
                </option>
              ))}
            </select>
          </label>

          <div className="transport-controls">
            <button type="button" onClick={togglePlayback} aria-pressed={isPlaying}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={restartReplay}>
              Restart
            </button>
            <button
              type="button"
              onClick={() => stepReplay(-1)}
              disabled={framePosition === 0}
              aria-label="Step backward"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => stepReplay(1)}
              disabled={framePosition === lastFramePosition}
              aria-label="Step forward"
            >
              Next
            </button>
          </div>

          <label className="time-scrubber">
            <span>Replay time</span>
            <input
              type="range"
              min="0"
              max={lastFramePosition}
              step="1"
              value={framePosition}
              onChange={(event) => scrubReplay(Number(event.target.value))}
            />
            <output aria-live="polite">
              {formatElapsed(viewState.elapsedMs)} / {formatElapsed(viewState.durationMs)}
            </output>
          </label>
        </section>
        <div className="signal-strip" aria-label="Score-driven output lanes">
          <span>{viewState.sourceLabel}</span>
          <span>{viewState.statusLabel}</span>
          <span>visual signature {viewState.visualParameters.signature}</span>
        </div>
      </section>
    </main>
  );
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.round(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
