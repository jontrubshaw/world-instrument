import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { InstrumentAudioEngine } from './audioEngine.ts';
import { serializeAudioParametersForDom } from './audioParameters.ts';
import { InstrumentStage } from './components/InstrumentStage.tsx';
import { BrowserVibrationHapticEngine, type HapticPlaybackState } from './hapticEngine.ts';
import { serializeHapticPatternForDom, type InstrumentHapticPattern } from './hapticParameters.ts';
import {
  readLiveWeatherInstrumentFrame,
  type LiveWeatherInstrumentFrameState,
} from './liveWeather.ts';
import {
  REPLAY_PLAYBACK_INTERVAL_MS,
  evaluateReplayFrame,
  loadReplayArchives,
  type ReplayInstrumentFrameState,
} from './replayArchive.ts';

type AudioControlState =
  | AudioContextState
  | 'interrupted'
  | 'stopped'
  | 'starting'
  | 'unsupported'
  | 'error';

type HapticControlState = 'checking' | 'unsupported' | 'disabled' | 'enabled' | 'blocked';
type InputMode = 'live' | 'replay';
type LiveWeatherControlStatus = 'idle' | 'loading' | 'ready' | 'stale' | 'offline' | 'error';

interface LiveWeatherControlState {
  readonly status: LiveWeatherControlStatus;
  readonly frame?: LiveWeatherInstrumentFrameState;
  readonly errorMessage?: string;
  readonly sequence?: number;
}

type InstrumentViewState = LiveWeatherInstrumentFrameState | ReplayInstrumentFrameState;

export function App() {
  const [archives] = useState(() => loadReplayArchives());
  const [archiveId, setArchiveId] = useState(archives[0]?.id ?? '');
  const [framePosition, setFramePosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('replay');
  const [liveWeather, setLiveWeather] = useState<LiveWeatherControlState>({ status: 'idle' });
  const [audioControlState, setAudioControlState] = useState<AudioControlState>('stopped');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [hapticControlState, setHapticControlState] = useState(initialHapticControlState);
  const [hapticsEnabled, setHapticsEnabled] = useState(false);
  const audioEngineRef = useRef<InstrumentAudioEngine | undefined>(undefined);
  const hapticEngineRef = useRef<BrowserVibrationHapticEngine | undefined>(undefined);
  const hapticActivationPatternKeyRef = useRef<string | undefined>(undefined);
  const activeArchive = archives.find((archive) => archive.id === archiveId) ?? archives[0];

  const replayViewState = useMemo(() => {
    if (activeArchive === undefined) {
      throw new Error('Expected at least one replay archive.');
    }

    return evaluateReplayFrame(activeArchive, framePosition);
  }, [activeArchive, framePosition]);
  const viewState: InstrumentViewState =
    inputMode === 'live' && liveWeather.frame !== undefined ? liveWeather.frame : replayViewState;
  const lastFramePosition = replayViewState.frameCount - 1;
  const stageGlowStyle = {
    '--stage-glow-color': viewState.visualParameters.accentColor,
    '--stage-glow-opacity': String(viewState.visualParameters.glowOpacity),
  } as CSSProperties;
  const audioIsActive =
    audioControlState === 'running' ||
    audioControlState === 'suspended' ||
    audioControlState === 'interrupted';
  const audioStatusLabel = audioStatusText(audioControlState, isAudioMuted);
  const hapticsSupported =
    hapticControlState !== 'checking' && hapticControlState !== 'unsupported';
  const hapticStatusLabel = hapticStatusText(
    hapticControlState,
    hapticsEnabled,
    viewState.hapticPattern.enabled,
  );
  const liveWeatherStatusLabel = liveWeatherStatusText(liveWeather);

  useEffect(() => {
    if (!isPlaying || inputMode !== 'replay') {
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
  }, [inputMode, isPlaying, lastFramePosition]);

  useEffect(() => {
    audioEngineRef.current?.applyParameters(viewState.audioParameters);
  }, [viewState.audioParameters]);

  useEffect(() => {
    if (!hapticsEnabled) {
      return;
    }

    const patternKey = hapticPatternPlaybackKey(viewState.hapticPattern);

    if (hapticActivationPatternKeyRef.current === patternKey) {
      hapticActivationPatternKeyRef.current = undefined;

      return;
    }

    hapticActivationPatternKeyRef.current = undefined;

    const playbackState = hapticEngineRef.current?.play(viewState.hapticPattern) ?? 'unsupported';
    setHapticControlState(hapticControlStateFromPlayback(playbackState));
  }, [hapticsEnabled, viewState.hapticPattern]);

  useEffect(() => {
    const engine = new BrowserVibrationHapticEngine();
    hapticEngineRef.current = engine;

    return () => {
      void audioEngineRef.current?.stop();
      hapticEngineRef.current?.stop();
    };
  }, []);

  const selectArchive = (nextArchiveId: string) => {
    setInputMode('replay');
    setArchiveId(nextArchiveId);
    setFramePosition(0);
    setIsPlaying(false);
  };

  const selectReplayMode = () => {
    setInputMode('replay');
    setIsPlaying(false);
  };

  const refreshLiveWeather = async () => {
    setInputMode('live');
    setIsPlaying(false);

    if (browserIsOffline()) {
      setLiveWeather((current) => ({
        ...current,
        status: 'offline',
        errorMessage: 'Browser reports that the network is offline. Replay remains available.',
      }));

      return;
    }

    const afterSequence = liveWeather.sequence;
    setLiveWeather((current) => ({
      status: 'loading',
      ...(current.frame === undefined ? {} : { frame: current.frame }),
      ...(current.sequence === undefined ? {} : { sequence: current.sequence }),
    }));

    try {
      const result = await readLiveWeatherInstrumentFrame(
        afterSequence === undefined ? {} : { afterSequence },
      );

      setLiveWeather((current) => {
        const nextFrame = result.frame ?? current.frame;

        return {
          status: result.status,
          ...(nextFrame === undefined ? {} : { frame: nextFrame }),
          ...(result.errorMessage === undefined ? {} : { errorMessage: result.errorMessage }),
          sequence: result.state.sequence,
        };
      });
    } catch (error) {
      setLiveWeather((current) => ({
        ...current,
        status: 'error',
        errorMessage:
          error instanceof Error ? error.message : 'Live weather request failed unexpectedly.',
      }));
    }
  };

  const selectLiveMode = () => {
    setInputMode('live');
    setIsPlaying(false);

    if (liveWeather.frame === undefined) {
      void refreshLiveWeather();
    }
  };

  const togglePlayback = () => {
    setInputMode('replay');

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
    setInputMode('replay');
    setFramePosition(0);
    setIsPlaying(false);
  };

  const stepReplay = (direction: -1 | 1) => {
    setInputMode('replay');
    setIsPlaying(false);
    setFramePosition((currentPosition) =>
      Math.min(Math.max(currentPosition + direction, 0), lastFramePosition),
    );
  };

  const scrubReplay = (nextPosition: number) => {
    setInputMode('replay');
    setIsPlaying(false);
    setFramePosition(nextPosition);
  };

  const startAudio = async () => {
    setAudioControlState('starting');

    try {
      const engine = audioEngineRef.current ?? new InstrumentAudioEngine();
      audioEngineRef.current = engine;
      engine.setMuted(isAudioMuted);
      const nextState = await engine.start(viewState.audioParameters);
      setAudioControlState(nextState);
    } catch {
      setAudioControlState('error');
    }
  };

  const stopAudio = async () => {
    try {
      await audioEngineRef.current?.stop();
    } finally {
      setAudioControlState('stopped');
    }
  };

  const toggleAudioMute = () => {
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    audioEngineRef.current?.setMuted(nextMuted);
  };

  const toggleHaptics = () => {
    const engine = hapticEngineRef.current;

    if (engine === undefined || engine.state === 'unsupported') {
      setHapticControlState('unsupported');

      return;
    }

    if (hapticsEnabled) {
      setHapticsEnabled(false);
      setHapticControlState(hapticControlStateFromPlayback(engine.stop()));

      return;
    }

    setHapticControlState(hapticControlStateFromPlayback(engine.play(viewState.hapticPattern)));
    hapticActivationPatternKeyRef.current = hapticPatternPlaybackKey(viewState.hapticPattern);
    setHapticsEnabled(true);
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
          Live and recorded weather streams pass through the same deterministic score, pressing
          palette, pulse, motion, atmosphere, sound, and haptics into the instrument.
        </p>
        <section
          className="mode-controls"
          aria-label="Input mode controls"
          data-input-mode={inputMode}
        >
          <button type="button" onClick={selectLiveMode} aria-pressed={inputMode === 'live'}>
            Live weather
          </button>
          <button type="button" onClick={selectReplayMode} aria-pressed={inputMode === 'replay'}>
            Replay archive
          </button>
        </section>

        <section
          className="live-weather-controls"
          aria-label="Live weather controls"
          data-live-status={liveWeather.status}
          data-live-signature={liveWeather.frame?.visualParameters.signature ?? ''}
        >
          <div className="transport-controls">
            <button
              type="button"
              onClick={() => {
                void refreshLiveWeather();
              }}
              disabled={liveWeather.status === 'loading'}
            >
              {liveWeather.status === 'loading' ? 'Loading live weather' : 'Refresh live weather'}
            </button>
          </div>
          <p aria-live="polite">{liveWeatherStatusLabel}</p>
        </section>
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

          <section
            className="audio-controls"
            aria-label="Audio controls"
            data-audio-state={audioControlState}
            data-audio-muted={String(isAudioMuted)}
            data-audio-parameters={serializeAudioParametersForDom(viewState.audioParameters)}
          >
            <div className="transport-controls">
              <button
                type="button"
                onClick={() => {
                  void startAudio();
                }}
                disabled={audioControlState === 'starting' || audioIsActive}
              >
                Start audio
              </button>
              <button type="button" onClick={() => void stopAudio()} disabled={!audioIsActive}>
                Stop audio
              </button>
              <button type="button" onClick={toggleAudioMute} disabled={!audioIsActive}>
                {isAudioMuted ? 'Unmute audio' : 'Mute audio'}
              </button>
            </div>
            <p aria-live="polite">
              {audioStatusLabel} / tone {formatHertz(viewState.audioParameters.carrierFrequencyHz)},
              texture {viewState.audioParameters.textureGain.toFixed(3)}
            </p>
          </section>

          <section
            className="haptic-controls"
            aria-label="Haptic controls"
            data-haptic-state={hapticControlState}
            data-haptic-enabled={String(hapticsEnabled)}
            data-haptic-supported={String(hapticsSupported)}
            data-haptic-pattern={serializeHapticPatternForDom(viewState.hapticPattern)}
          >
            <div className="transport-controls">
              <button type="button" onClick={toggleHaptics} disabled={!hapticsSupported}>
                {hapticsEnabled ? 'Disable haptics' : 'Enable haptics'}
              </button>
            </div>
            <p aria-live="polite">
              {hapticStatusLabel} / pulse {viewState.hapticPattern.pulseDurationMs} ms x{' '}
              {viewState.hapticPattern.repeatCount}
            </p>
          </section>
        </section>
        <div className="signal-strip" aria-label="Score-driven output lanes">
          <span>{inputMode === 'live' ? 'live mode' : 'replay mode'}</span>
          <span>{viewState.sourceLabel}</span>
          <span>{viewState.statusLabel}</span>
          <span>visual signature {viewState.visualParameters.signature}</span>
          <span>audio signature {viewState.audioParameters.signature}</span>
          <span>haptic signature {viewState.hapticPattern.signature}</span>
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

function formatHertz(value: number): string {
  return `${value.toFixed(1)} Hz`;
}

function browserIsOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

function liveWeatherStatusText(state: LiveWeatherControlState): string {
  if (state.status === 'idle') {
    return 'Live weather is ready to load from Open-Meteo without credentials.';
  }

  if (state.status === 'loading') {
    return 'Loading current weather from Open-Meteo...';
  }

  if (state.status === 'offline') {
    return state.errorMessage ?? 'Browser is offline. Replay remains available.';
  }

  if (state.status === 'error') {
    return `Live adapter error: ${state.errorMessage ?? 'weather request failed'}. Replay remains available.`;
  }

  const observedAt = state.frame?.observedAt;
  const timestamp = observedAt === undefined ? 'unknown time' : formatLiveTimestamp(observedAt);

  return state.status === 'stale'
    ? `Live weather is stale from ${timestamp}; replay remains available for comparison.`
    : `Live weather current from ${timestamp}.`;
}

function formatLiveTimestamp(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function audioStatusText(state: AudioControlState, isMuted: boolean): string {
  if (state === 'unsupported') {
    return 'Audio unsupported in this browser';
  }

  if (state === 'error') {
    return 'Audio could not start';
  }

  if (state === 'starting') {
    return 'Audio starting after activation';
  }

  if (state === 'running') {
    return isMuted ? 'Audio muted' : 'Audio sounding';
  }

  if (state === 'suspended' || state === 'interrupted') {
    return 'Audio waiting for browser resume';
  }

  return 'Audio silent until Start audio is pressed';
}

function hapticControlStateFromPlayback(state: HapticPlaybackState): HapticControlState {
  if (state === 'unsupported') {
    return 'unsupported';
  }

  if (state === 'blocked') {
    return 'blocked';
  }

  if (state === 'disabled') {
    return 'disabled';
  }

  return 'enabled';
}

function hapticPatternPlaybackKey(pattern: InstrumentHapticPattern): string {
  return [
    pattern.scoreId,
    pattern.scoreVersion,
    pattern.frameIndex,
    pattern.signature,
    pattern.enabled,
    pattern.pattern.join(','),
  ].join('|');
}

function initialHapticControlState(): HapticControlState {
  if (typeof navigator === 'undefined') {
    return 'unsupported';
  }

  return typeof navigator.vibrate === 'function' ? 'disabled' : 'unsupported';
}

function hapticStatusText(
  state: HapticControlState,
  hapticsEnabled: boolean,
  currentPatternEnabled: boolean,
): string {
  if (state === 'checking') {
    return 'Checking haptic support';
  }

  if (state === 'unsupported') {
    return 'Haptics unavailable in this browser';
  }

  if (state === 'blocked') {
    return 'Haptics blocked by this browser';
  }

  if (!hapticsEnabled) {
    return 'Haptics available, disabled';
  }

  return currentPatternEnabled
    ? 'Haptics following score'
    : 'Haptics enabled, current frame silent';
}
