import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { InstrumentAudioEngine } from './audioEngine.ts';
import { serializeAudioParametersForDom } from './audioParameters.ts';
import { InstrumentStage } from './components/InstrumentStage.tsx';
import { BrowserVibrationHapticEngine, type HapticPlaybackState } from './hapticEngine.ts';
import { serializeHapticPatternForDom, type InstrumentHapticPattern } from './hapticParameters.ts';
import {
  LIVE_WEATHER_REFRESH_INTERVAL_MS,
  readLiveWeatherFrame,
  type LiveWeatherInstrumentFrameState,
  type LiveWeatherReadStatus,
} from './liveWeather.ts';
import {
  REPLAY_PLAYBACK_INTERVAL_MS,
  evaluateReplayFrame,
  loadReplayArchives,
} from './replayArchive.ts';

type AudioControlState =
  | AudioContextState
  | 'interrupted'
  | 'stopped'
  | 'starting'
  | 'unsupported'
  | 'error';

type HapticControlState = 'checking' | 'unsupported' | 'disabled' | 'enabled' | 'blocked';

type InstrumentMode = 'live' | 'replay';

type LiveWeatherUiStatus = LiveWeatherReadStatus | 'idle' | 'loading';

interface LiveWeatherUiState {
  readonly status: LiveWeatherUiStatus;
  readonly message: string;
  readonly frame?: LiveWeatherInstrumentFrameState;
}

export function App() {
  const [archives] = useState(() => loadReplayArchives());
  const [instrumentMode, setInstrumentMode] = useState<InstrumentMode>('live');
  const [archiveId, setArchiveId] = useState(archives[0]?.id ?? '');
  const [framePosition, setFramePosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liveRefreshToken, setLiveRefreshToken] = useState(0);
  const [liveWeatherState, setLiveWeatherState] = useState<LiveWeatherUiState>({
    status: 'loading',
    message: 'Loading current weather...',
  });
  const [audioControlState, setAudioControlState] = useState<AudioControlState>('stopped');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [hapticControlState, setHapticControlState] = useState(initialHapticControlState);
  const [hapticsEnabled, setHapticsEnabled] = useState(false);
  const audioEngineRef = useRef<InstrumentAudioEngine | undefined>(undefined);
  const hapticEngineRef = useRef<BrowserVibrationHapticEngine | undefined>(undefined);
  const hapticActivationPatternKeyRef = useRef<string | undefined>(undefined);
  const liveSequenceRef = useRef<number | undefined>(undefined);
  const activeArchive = archives.find((archive) => archive.id === archiveId) ?? archives[0];

  const replayViewState = useMemo(() => {
    if (activeArchive === undefined) {
      throw new Error('Expected at least one replay archive.');
    }

    return evaluateReplayFrame(activeArchive, framePosition);
  }, [activeArchive, framePosition]);
  const viewState =
    instrumentMode === 'live' && liveWeatherState.frame !== undefined
      ? liveWeatherState.frame
      : replayViewState;
  const liveFallbackActive = instrumentMode === 'live' && liveWeatherState.frame === undefined;
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

  useEffect(() => {
    if (!isPlaying || instrumentMode !== 'replay') {
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
  }, [instrumentMode, isPlaying, lastFramePosition]);

  useEffect(() => {
    if (instrumentMode !== 'live') {
      return;
    }

    const abortController = new AbortController();
    let isCurrentRequest = true;

    void readLiveWeatherFrame({
      signal: abortController.signal,
      ...(liveSequenceRef.current === undefined
        ? {}
        : { previousSequence: liveSequenceRef.current }),
    })
      .then((nextState) => {
        if (!isCurrentRequest) {
          return;
        }

        if (nextState.frame !== undefined) {
          liveSequenceRef.current = nextState.frame.streamSequence;
        }

        setLiveWeatherState((currentState) => {
          const frame = nextState.frame ?? currentState.frame;

          return {
            status: nextState.status,
            message: nextState.message,
            ...(frame === undefined ? {} : { frame }),
          };
        });
      })
      .catch((error: unknown) => {
        if (!isCurrentRequest || abortController.signal.aborted) {
          return;
        }

        setLiveWeatherState((currentState) => ({
          ...currentState,
          status: 'error',
          message:
            error instanceof Error
              ? `Live weather adapter error: ${error.message}`
              : 'Live weather adapter error; replay remains available.',
        }));
      });

    return () => {
      isCurrentRequest = false;
      abortController.abort();
    };
  }, [instrumentMode, liveRefreshToken]);

  useEffect(() => {
    if (instrumentMode !== 'live') {
      return;
    }

    const intervalId = window.setInterval(() => {
      markLiveWeatherLoading(setLiveWeatherState);
      setLiveRefreshToken((currentToken) => currentToken + 1);
    }, LIVE_WEATHER_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [instrumentMode]);

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

  const selectInstrumentMode = (nextMode: InstrumentMode) => {
    setInstrumentMode(nextMode);

    if (nextMode === 'live') {
      setIsPlaying(false);
      markLiveWeatherLoading(setLiveWeatherState);
    }
  };

  const selectArchive = (nextArchiveId: string) => {
    setArchiveId(nextArchiveId);
    setFramePosition(0);
    setIsPlaying(false);
    setInstrumentMode('replay');
  };

  const refreshLiveWeather = () => {
    setInstrumentMode('live');
    setIsPlaying(false);
    markLiveWeatherLoading(setLiveWeatherState);
    setLiveRefreshToken((currentToken) => currentToken + 1);
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
          Current and recorded weather streams pass through the same deterministic score, pressing
          palette, pulse, motion, sound, and haptics into the instrument.
        </p>
        <section
          className="stream-controls"
          aria-label="Stream controls"
          data-instrument-mode={instrumentMode}
          data-live-state={liveWeatherState.status}
        >
          <div className="mode-switch" role="group" aria-label="Input mode">
            <button
              type="button"
              onClick={() => {
                selectInstrumentMode('live');
              }}
              aria-pressed={instrumentMode === 'live'}
            >
              Live weather
            </button>
            <button
              type="button"
              onClick={() => {
                selectInstrumentMode('replay');
              }}
              aria-pressed={instrumentMode === 'replay'}
            >
              Replay archive
            </button>
          </div>

          <p className="live-status" role="status" aria-live="polite">
            {liveWeatherStatusText(liveWeatherState, liveFallbackActive)}
          </p>

          <div className="transport-controls">
            <button
              type="button"
              onClick={refreshLiveWeather}
              disabled={liveWeatherState.status === 'loading'}
            >
              {liveWeatherState.status === 'loading' ? 'Refreshing live' : 'Refresh live'}
            </button>
          </div>

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
              <button
                type="button"
                onClick={togglePlayback}
                aria-pressed={isPlaying}
                disabled={instrumentMode !== 'replay'}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button type="button" onClick={restartReplay} disabled={instrumentMode !== 'replay'}>
                Restart
              </button>
              <button
                type="button"
                onClick={() => {
                  stepReplay(-1);
                }}
                disabled={instrumentMode !== 'replay' || framePosition === 0}
                aria-label="Step backward"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  stepReplay(1);
                }}
                disabled={instrumentMode !== 'replay' || framePosition === lastFramePosition}
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
                disabled={instrumentMode !== 'replay'}
                onChange={(event) => {
                  scrubReplay(Number(event.target.value));
                }}
              />
              <output aria-live="polite">
                {formatElapsed(replayViewState.elapsedMs)} /{' '}
                {formatElapsed(replayViewState.durationMs)}
              </output>
            </label>
          </section>

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
          <span>
            {instrumentMode === 'live' && !liveFallbackActive ? 'live mode' : 'replay mode'}
          </span>
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

function liveWeatherStatusText(state: LiveWeatherUiState, liveFallbackActive: boolean): string {
  const fallbackSuffix = liveFallbackActive ? ' Showing replay fallback.' : '';

  if (state.status === 'idle') {
    return 'Live weather has not loaded yet.';
  }

  if (state.status === 'loading') {
    return state.message;
  }

  return `${state.message}${fallbackSuffix}`;
}

function markLiveWeatherLoading(
  setLiveWeatherState: Dispatch<SetStateAction<LiveWeatherUiState>>,
): void {
  setLiveWeatherState((currentState) => ({
    ...currentState,
    status: 'loading',
    message:
      currentState.frame === undefined
        ? 'Loading current weather...'
        : 'Refreshing current weather...',
  }));
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
