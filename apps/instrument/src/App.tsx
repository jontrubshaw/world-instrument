import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react';

import { InstrumentStage } from './components/InstrumentStage.tsx';
import {
  DEFAULT_WEATHER_REPLAY,
  WEATHER_REPLAY_ARCHIVE,
  clampReplayFrameIndex,
  evaluateWeatherReplayFrame,
  nextReplayFrameIndex,
  previousReplayFrameIndex,
  replayPlaybackDelayMs,
} from './weatherInstrument.ts';

export function App() {
  const [selectedArchiveId, setSelectedArchiveId] = useState(DEFAULT_WEATHER_REPLAY.id);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const selectedArchive =
    WEATHER_REPLAY_ARCHIVE.find((entry) => entry.id === selectedArchiveId) ?? DEFAULT_WEATHER_REPLAY;
  const replaySnapshot = selectedArchive.snapshot;
  const currentFrameIndex = clampReplayFrameIndex(replaySnapshot, frameIndex);
  const viewState = useMemo(
    () => evaluateWeatherReplayFrame(replaySnapshot, currentFrameIndex),
    [currentFrameIndex, replaySnapshot],
  );
  const isLastFrame = currentFrameIndex >= viewState.frameCount - 1;
  const playbackStatusLabel = isPlaying ? 'replay playing' : 'replay paused';
  const stageGlowStyle = {
    '--stage-glow-color': viewState.visualParameters.accentColor,
    '--stage-glow-opacity': String(viewState.visualParameters.glowOpacity),
  } as CSSProperties;

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFrameIndex((current) => {
        const nextFrameIndex = nextReplayFrameIndex(replaySnapshot, current);

        if (nextFrameIndex >= replaySnapshot.frames.length - 1) {
          setIsPlaying(false);
        }

        return nextFrameIndex;
      });
    }, replayPlaybackDelayMs(replaySnapshot, currentFrameIndex));

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentFrameIndex, isPlaying, replaySnapshot]);

  const handleArchiveChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedArchiveId(event.currentTarget.value);
    setFrameIndex(0);
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    setFrameIndex(isLastFrame ? 0 : currentFrameIndex);
    setIsPlaying(true);
  };

  const handleRestart = () => {
    setFrameIndex(0);
    setIsPlaying(false);
  };

  const handlePreviousFrame = () => {
    setFrameIndex((current) => previousReplayFrameIndex(replaySnapshot, current));
    setIsPlaying(false);
  };

  const handleNextFrame = () => {
    setFrameIndex((current) => nextReplayFrameIndex(replaySnapshot, current));
    setIsPlaying(false);
  };

  const handleScrub = (event: ChangeEvent<HTMLInputElement>) => {
    setFrameIndex(clampReplayFrameIndex(replaySnapshot, event.currentTarget.valueAsNumber));
    setIsPlaying(false);
  };

  return (
    <main className="instrument-shell" aria-labelledby="instrument-title">
      <section className="stage-panel" aria-label="Replay-driven instrument surface">
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
            <select value={selectedArchive.id} onChange={handleArchiveChange}>
              {WEATHER_REPLAY_ARCHIVE.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <div className="transport-row">
            <button type="button" onClick={handlePlayPause}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={handleRestart}>
              Restart
            </button>
            <button
              type="button"
              onClick={handlePreviousFrame}
              disabled={currentFrameIndex === 0}
              aria-label="Step to previous replay frame"
            >
              Step -
            </button>
            <button
              type="button"
              onClick={handleNextFrame}
              disabled={isLastFrame}
              aria-label="Step to next replay frame"
            >
              Step +
            </button>
          </div>
          <label className="scrub-control">
            <span>Replay time</span>
            <input
              type="range"
              min="0"
              max={String(viewState.frameCount - 1)}
              step="1"
              value={currentFrameIndex}
              onChange={handleScrub}
              aria-valuetext={`Frame ${String(currentFrameIndex + 1)} of ${String(
                viewState.frameCount,
              )}, ${formatElapsed(viewState.elapsedMs)}`}
            />
          </label>
          <p className="replay-readout" aria-live="polite">
            Frame {currentFrameIndex + 1} of {viewState.frameCount} ·{' '}
            {formatElapsed(viewState.elapsedMs)} of {formatElapsed(viewState.durationMs)} ·{' '}
            {viewState.visualParameters.condition}
          </p>
        </section>
        <div className="signal-strip" aria-label="Score-driven output lanes">
          <span>{viewState.sourceLabel}</span>
          <span>{playbackStatusLabel}</span>
          <span>frame {currentFrameIndex + 1}</span>
          <span>visual signature {viewState.visualParameters.signature}</span>
        </div>
      </section>
    </main>
  );
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
