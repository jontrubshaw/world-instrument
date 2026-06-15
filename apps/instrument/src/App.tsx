import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { InstrumentStage } from './components/InstrumentStage.tsx';
import {
  REPLAY_PLAYBACK_INTERVAL_MS,
  evaluateReplayFrame,
  loadReplayArchives,
} from './replayArchive.ts';
import { serializeAudioPlanForDom } from './audioParameters.ts';
import { createInstrumentAudioEngine, type InstrumentAudioEngine } from './audioEngine.ts';

type AudioStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'unavailable';

export function App() {
  const [archives] = useState(() => loadReplayArchives());
  const [archiveId, setArchiveId] = useState(archives[0]?.id ?? '');
  const [framePosition, setFramePosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle');
  const [audioError, setAudioError] = useState<string | undefined>();
  const audioEngineRef = useRef<InstrumentAudioEngine | null>(null);
  const activeArchive = archives.find((archive) => archive.id === archiveId) ?? archives[0];

  const viewState = useMemo(() => {
    if (activeArchive === undefined) {
      throw new Error('Expected at least one replay archive.');
    }

    return evaluateReplayFrame(activeArchive, framePosition);
  }, [activeArchive, framePosition]);
  const lastFramePosition = viewState.frameCount - 1;
  const audioStatusLabel = formatAudioStatus(audioStatus, isAudioMuted);
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

  useEffect(() => {
    audioEngineRef.current?.update(viewState.audioPlan, isAudioMuted);
  }, [isAudioMuted, viewState.audioPlan]);

  useEffect(() => {
    return () => {
      audioEngineRef.current?.stop();
      audioEngineRef.current = null;
    };
  }, []);

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

  const startAudio = async () => {
    setAudioError(undefined);
    setAudioStatus('starting');

    try {
      const audioEngine =
        audioEngineRef.current ?? createInstrumentAudioEngine(viewState.audioPlan, isAudioMuted);

      audioEngineRef.current = audioEngine;
      audioEngine.update(viewState.audioPlan, isAudioMuted);
      await audioEngine.start();
      setAudioStatus('running');
    } catch (error) {
      audioEngineRef.current?.stop();
      audioEngineRef.current = null;
      setAudioStatus('unavailable');
      setAudioError(error instanceof Error ? error.message : 'Audio initialization failed.');
    }
  };

  const stopAudio = () => {
    audioEngineRef.current?.stop();
    audioEngineRef.current = null;
    setAudioError(undefined);
    setAudioStatus('stopped');
  };

  return (
    <main className="instrument-shell" aria-labelledby="instrument-title">
      <section className="stage-panel" aria-label="Instrument surface">
        <InstrumentStage visualParameters={viewState.visualParameters} />
        <div className="stage-glow" style={stageGlowStyle} aria-hidden="true" />
      </section>

      <section className="voice-panel">
        <p className="eyebrow">World Instrument / weather score</p>
        <h1 id="instrument-title">A weather score tuned into light and tone.</h1>
        <p className="lead">
          A recorded stream is replayed through the first deterministic weather score, pressing
          palette, pulse, motion, atmosphere, and sound directly into the instrument.
        </p>
        <section className="replay-controls" aria-label="Replay controls">
          <label className="archive-picker">
            <span>Archive</span>
            <select
              value={archiveId}
              onChange={(event) => {
                selectArchive(event.target.value);
              }}
            >
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
              onClick={() => {
                stepReplay(-1);
              }}
              disabled={framePosition === 0}
              aria-label="Step backward"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => {
                stepReplay(1);
              }}
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
              onChange={(event) => {
                scrubReplay(Number(event.target.value));
              }}
            />
            <output aria-live="polite">
              {formatElapsed(viewState.elapsedMs)} / {formatElapsed(viewState.durationMs)}
            </output>
          </label>
        </section>
        <section
          className="audio-controls"
          aria-label="Audio controls"
          data-audio-status={audioStatus}
          data-audio-muted={String(isAudioMuted)}
          data-audio-plan={serializeAudioPlanForDom(viewState.audioPlan)}
        >
          <div className="audio-controls__header">
            <span>Audio output</span>
            <output aria-live="polite">{audioStatusLabel}</output>
          </div>
          <div className="transport-controls audio-buttons">
            <button
              type="button"
              onClick={() => {
                void startAudio();
              }}
              disabled={audioStatus === 'starting' || audioStatus === 'running'}
            >
              Start audio
            </button>
            <button type="button" onClick={stopAudio} disabled={audioStatus !== 'running'}>
              Stop
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAudioMuted((currentMuted) => !currentMuted);
              }}
              aria-pressed={isAudioMuted}
            >
              {isAudioMuted ? 'Unmute' : 'Mute'}
            </button>
          </div>
          <p className="audio-description">
            {audioError ??
              `Tone ${viewState.audioPlan.carrierFrequencyHz.toFixed(1)} Hz · filter ${viewState.audioPlan.filterFrequencyHz.toFixed(0)} Hz · frame ${String(viewState.audioPlan.frameIndex + 1)}`}
          </p>
        </section>
        <div className="signal-strip" aria-label="Score-driven output lanes">
          <span>{viewState.sourceLabel}</span>
          <span>{viewState.statusLabel}</span>
          <span>visual signature {viewState.visualParameters.signature}</span>
          <span>audio signature {viewState.audioPlan.signature}</span>
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

function formatAudioStatus(status: AudioStatus, muted: boolean): string {
  if (status === 'running') {
    return muted ? 'Audio muted' : 'Audio running';
  }

  if (status === 'starting') {
    return 'Audio starting';
  }

  if (status === 'stopped') {
    return 'Audio stopped';
  }

  if (status === 'unavailable') {
    return 'Audio unavailable';
  }

  return 'Audio standing by';
}
