import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { BROWSER_SENSOR_STREAM_SOURCE_ID } from '@world-instrument/adapters';
import type { JsonObject, ReplayFrame } from '@world-instrument/core';

import { InstrumentAudioEngine } from './audioEngine.ts';
import { serializeAudioParametersForDom } from './audioParameters.ts';
import {
  BROWSER_SENSOR_POINTER_REFRESH_MS,
  createInitialBrowserSensorRuntimeState,
  isBrowserSensorStateAtLeastAsFresh,
  requestBrowserSensorPermission,
  updateBrowserSensorMotion,
  updateBrowserSensorOrientation,
  updateBrowserSensorPointer,
  type BrowserSensorRuntimeState,
} from './browserSensor.ts';
import { InstrumentStage } from './components/InstrumentStage.tsx';
import { BrowserVibrationHapticEngine, type HapticPlaybackState } from './hapticEngine.ts';
import { serializeHapticPatternForDom, type InstrumentHapticPattern } from './hapticParameters.ts';
import { LIVE_WEATHER_REFRESH_INTERVAL_MS } from './liveWeather.ts';
import {
  appendCapturedReplayFrame,
  buildReplaySnapshot,
  createReplayCaptureFrameFromArchive,
  createReplayCaptureSessionForFrame,
  createReplayDownloadFilename,
  prepareFrameForCaptureClock,
  replayCaptureFrameKey,
  serializeReplaySnapshot,
  stopReplayCaptureSession,
  type ReplayCaptureFrameInput,
  type ReplayCaptureSession,
} from './replayCapture.ts';
import {
  REPLAY_PLAYBACK_INTERVAL_MS,
  evaluateReplayFrame,
  loadReplayArchives,
  type ReplayArchive,
  type ReplayInstrumentFrameState,
} from './replayArchive.ts';
import {
  DEFAULT_INSTRUMENT_SOURCE_ID,
  DEFAULT_INSTRUMENT_SOURCE_MODE,
  browserSensorStaleRefreshDelayMs,
  instrumentSourceDefinitions,
  readSourceFrame,
  selectableModeForSource,
  sourceCapabilitySummary,
  sourceDefinition,
  sourceHasCompatibleScore,
  sourceScoreLabel,
  sourceSupportsMode,
  type SourceInstrumentFrameState,
  type SourceReadState,
} from './sourceRuntime.ts';

type AudioControlState =
  | AudioContextState
  | 'interrupted'
  | 'stopped'
  | 'starting'
  | 'unsupported'
  | 'error';

type HapticControlState = 'checking' | 'unsupported' | 'disabled' | 'enabled' | 'blocked';

type InstrumentMode = 'fixture' | 'live' | 'replay';
type ProvenanceDisplayMode = InstrumentMode | 'replay-fallback';
type SourceUiState =
  | SourceReadState
  | {
      readonly sourceId: string;
      readonly sourceName: string;
      readonly sourceMode: Exclude<InstrumentMode, 'replay'>;
      readonly status: 'loading';
      readonly message: string;
      readonly seed?: string;
      readonly frame?: SourceInstrumentFrameState;
      readonly streamState?: SourceReadState['streamState'];
    };

const PROVENANCE_CLOCK_INTERVAL_MS = 15_000;

export function App() {
  const [archives] = useState(() => loadReplayArchives());
  const [selectedSourceId, setSelectedSourceId] = useState(DEFAULT_INSTRUMENT_SOURCE_ID);
  const [instrumentMode, setInstrumentMode] = useState<InstrumentMode>(
    DEFAULT_INSTRUMENT_SOURCE_MODE,
  );
  const [archiveId, setArchiveId] = useState(archives[0]?.id ?? '');
  const [framePosition, setFramePosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sourceRefreshToken, setSourceRefreshToken] = useState(0);
  const [browserSensorState, setBrowserSensorState] = useState(
    createInitialBrowserSensorRuntimeState,
  );
  const [sourceState, setSourceState] = useState<SourceUiState>({
    sourceId: DEFAULT_INSTRUMENT_SOURCE_ID,
    sourceName: sourceDefinition(DEFAULT_INSTRUMENT_SOURCE_ID).displayName,
    sourceMode: DEFAULT_INSTRUMENT_SOURCE_MODE,
    status: 'loading',
    message: 'Loading Open-Meteo weather...',
  });
  const [provenanceNow, setProvenanceNow] = useState(() => new Date());
  const [audioControlState, setAudioControlState] = useState<AudioControlState>('stopped');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [hapticControlState, setHapticControlState] = useState(initialHapticControlState);
  const [hapticsEnabled, setHapticsEnabled] = useState(false);
  const [captureSession, setCaptureSession] = useState<ReplayCaptureSession | undefined>(undefined);
  const [captureExportFilename, setCaptureExportFilename] = useState('');
  const audioEngineRef = useRef<InstrumentAudioEngine | undefined>(undefined);
  const hapticEngineRef = useRef<BrowserVibrationHapticEngine | undefined>(undefined);
  const hapticActivationPatternKeyRef = useRef<string | undefined>(undefined);
  const sourceSequenceRef = useRef<number | undefined>(undefined);
  const captureLastFrameKeyRef = useRef<string | undefined>(undefined);
  const browserSensorRefreshRef = useRef<number | undefined>(undefined);
  const browserSensorTrailingRefreshRef = useRef<number | undefined>(undefined);
  const browserSensorStateRef = useRef(browserSensorState);
  const browserSensorSnapshotRef = useRef(browserSensorState.snapshot);
  const publishBrowserSensorState = useCallback((nextState: BrowserSensorRuntimeState) => {
    browserSensorStateRef.current = nextState;
    browserSensorSnapshotRef.current = nextState.snapshot;
    setBrowserSensorState(nextState);
  }, []);
  const sampleBrowserSensorState = useCallback((nextState: BrowserSensorRuntimeState) => {
    browserSensorStateRef.current = nextState;
    browserSensorSnapshotRef.current = nextState.snapshot;
  }, []);
  const selectedSource = sourceDefinition(selectedSourceId);
  const sourceReplayArchives = useMemo(
    () => archives.filter((archive) => archiveMatchesSource(archive, selectedSource.kind)),
    [archives, selectedSource.kind],
  );
  const sourceReplayAvailable = sourceReplayArchives.length > 0;
  const activeArchive =
    sourceReplayArchives.find((archive) => archive.id === archiveId) ??
    sourceReplayArchives[0] ??
    archives[0];

  const replayViewState = useMemo(() => {
    if (activeArchive === undefined) {
      throw new Error('Expected at least one replay archive.');
    }

    return evaluateReplayFrame(activeArchive, framePosition);
  }, [activeArchive, framePosition]);
  const activeReplayFrame = activeArchive?.snapshot.frames[replayViewState.framePosition];
  const viewState =
    instrumentMode !== 'replay' && sourceState.frame !== undefined
      ? sourceState.frame
      : replayViewState;
  const sourceFallbackActive = instrumentMode !== 'replay' && sourceState.frame === undefined;
  const replayFallbackActive = instrumentMode === 'replay' && !sourceReplayAvailable;
  const visibleFallbackActive = sourceFallbackActive || replayFallbackActive;
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
  const sourceStatusLabel = sourceStatusText({
    sourceState,
    instrumentMode,
    sourceName: selectedSource.displayName,
    sourceReplayAvailable,
    visibleFallbackActive,
  });
  const sourceDataStatus =
    instrumentMode === 'replay'
      ? sourceReplayAvailable
        ? 'ready'
        : 'unavailable'
      : sourceState.status;
  const provenanceState = useMemo(
    () =>
      buildProvenanceViewState({
        activeArchive,
        activeReplayFrame,
        instrumentMode,
        now: provenanceNow,
        replayViewState,
        selectedSourceId,
        selectedSourceName: selectedSource.displayName,
        activeOutput: viewState.output,
        sourceState,
        visibleFallbackActive,
      }),
    [
      activeArchive,
      activeReplayFrame,
      instrumentMode,
      provenanceNow,
      replayViewState,
      selectedSource.displayName,
      selectedSourceId,
      sourceState,
      viewState.output,
      visibleFallbackActive,
    ],
  );
  const currentCaptureFrame = useMemo<ReplayCaptureFrameInput | undefined>(() => {
    if (instrumentMode !== 'replay') {
      if (sourceState.frame !== undefined && sourceState.streamState !== undefined) {
        return {
          sourceMode: instrumentMode,
          frameIndex: sourceState.frame.frameIndex,
          capturedAt: sourceState.frame.observedAt,
          streams: [sourceState.streamState],
          seed: sourceState.frame.seed,
          output: sourceState.frame.output,
          visualSignature: sourceState.frame.visualParameters.signature,
          audioSignature: sourceState.frame.audioParameters.signature,
          hapticSignature: sourceState.frame.hapticPattern.signature,
          provenance: provenanceState.captureMetadata,
          sourceLabel: sourceState.frame.sourceLabel,
          statusLabel: sourceState.frame.statusLabel,
        };
      }

      const fallbackFrame =
        activeArchive === undefined
          ? undefined
          : createReplayCaptureFrameFromArchive({
              archive: activeArchive,
              viewState: replayViewState,
            });

      return fallbackFrame === undefined
        ? undefined
        : {
            ...fallbackFrame,
            provenance: provenanceState.captureMetadata,
          };
    }

    const replayFrame =
      activeArchive === undefined
        ? undefined
        : createReplayCaptureFrameFromArchive({
            archive: activeArchive,
            viewState: replayViewState,
          });

    return replayFrame === undefined
      ? undefined
      : {
          ...replayFrame,
          provenance: provenanceState.captureMetadata,
        };
  }, [
    activeArchive,
    instrumentMode,
    provenanceState.captureMetadata,
    replayViewState,
    sourceState.frame,
    sourceState.streamState,
  ]);
  const captureFrameCount = captureSession?.frames.length ?? 0;
  const captureIsRecording = captureSession?.status === 'recording';
  const captureCanExport = captureFrameCount > 0;
  const captureStatusLabel = captureStatusText(captureSession, captureExportFilename);

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
    const intervalId = window.setInterval(() => {
      setProvenanceNow(new Date());
    }, PROVENANCE_CLOCK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (instrumentMode === 'replay') {
      return;
    }

    const abortController = new AbortController();
    let isCurrentRequest = true;

    void readSourceFrame({
      sourceId: selectedSourceId,
      sourceMode: instrumentMode,
      ...(selectedSourceId === BROWSER_SENSOR_STREAM_SOURCE_ID
        ? { browserSensorSnapshot: browserSensorSnapshotRef.current }
        : {}),
      signal: abortController.signal,
      ...(sourceSequenceRef.current === undefined
        ? {}
        : { previousSequence: sourceSequenceRef.current }),
    })
      .then((nextState) => {
        if (!isCurrentRequest) {
          return;
        }

        if (nextState.frame !== undefined) {
          sourceSequenceRef.current = nextState.frame.streamSequence;
        }

        setSourceState((currentState) => mergeSourceUiState(currentState, nextState));
      })
      .catch((error: unknown) => {
        if (!isCurrentRequest || abortController.signal.aborted) {
          return;
        }

        setSourceState((currentState) => {
          const message =
            error instanceof Error
              ? `Source adapter error: ${error.message}`
              : 'Source adapter error; replay remains available.';

          if (currentState.frame !== undefined) {
            return {
              sourceId: currentState.sourceId,
              sourceName: currentState.sourceName,
              sourceMode: currentState.sourceMode,
              status: 'error',
              message,
              seed: currentState.frame.seed,
              frame: currentState.frame,
              ...(currentState.streamState === undefined
                ? {}
                : { streamState: currentState.streamState }),
            };
          }

          return {
            sourceId: currentState.sourceId,
            sourceName: currentState.sourceName,
            sourceMode: currentState.sourceMode,
            status: 'error',
            message,
          };
        });
      });

    return () => {
      isCurrentRequest = false;
      abortController.abort();
    };
  }, [instrumentMode, selectedSourceId, sourceRefreshToken]);

  useEffect(() => {
    if (!isBrowserSensorStateAtLeastAsFresh(browserSensorState, browserSensorStateRef.current)) {
      return;
    }

    browserSensorStateRef.current = browserSensorState;
    browserSensorSnapshotRef.current = browserSensorState.snapshot;
  }, [browserSensorState]);

  useEffect(() => {
    if (instrumentMode !== 'live') {
      return;
    }

    const intervalId = window.setInterval(() => {
      markSourceLoading(
        setSourceState,
        selectedSourceId,
        selectedSource.displayName,
        instrumentMode,
      );
      setSourceRefreshToken((currentToken) => currentToken + 1);
    }, LIVE_WEATHER_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [instrumentMode, selectedSource.displayName, selectedSourceId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (selectedSourceId !== BROWSER_SENSOR_STREAM_SOURCE_ID || instrumentMode !== 'live') {
      return;
    }

    let lastRefreshAt = 0;

    const requestSensorSourceRefresh = () => {
      if (browserSensorRefreshRef.current !== undefined) {
        return;
      }

      browserSensorRefreshRef.current = window.requestAnimationFrame(() => {
        browserSensorRefreshRef.current = undefined;
        setBrowserSensorState(browserSensorStateRef.current);
        setSourceRefreshToken((currentToken) => currentToken + 1);
      });
    };

    const refreshSensorSource = () => {
      const now = window.performance.now();
      const elapsedMs = now - lastRefreshAt;

      if (elapsedMs < BROWSER_SENSOR_POINTER_REFRESH_MS) {
        if (browserSensorTrailingRefreshRef.current === undefined) {
          browserSensorTrailingRefreshRef.current = window.setTimeout(() => {
            browserSensorTrailingRefreshRef.current = undefined;
            refreshSensorSource();
          }, BROWSER_SENSOR_POINTER_REFRESH_MS - elapsedMs);
        }

        return;
      }

      if (browserSensorTrailingRefreshRef.current !== undefined) {
        window.clearTimeout(browserSensorTrailingRefreshRef.current);
        browserSensorTrailingRefreshRef.current = undefined;
      }

      lastRefreshAt = now;
      requestSensorSourceRefresh();
    };

    const handlePointer = (event: PointerEvent) => {
      sampleBrowserSensorState(updateBrowserSensorPointer(browserSensorStateRef.current, event));
      refreshSensorSource();
    };
    const handleMotion = (event: DeviceMotionEvent) => {
      sampleBrowserSensorState(updateBrowserSensorMotion(browserSensorStateRef.current, event));
      refreshSensorSource();
    };
    const handleOrientation = (event: DeviceOrientationEvent) => {
      sampleBrowserSensorState(
        updateBrowserSensorOrientation(browserSensorStateRef.current, event),
      );
      refreshSensorSource();
    };

    window.addEventListener('pointermove', handlePointer, { passive: true });
    window.addEventListener('pointerdown', handlePointer, { passive: true });
    window.addEventListener('pointerup', handlePointer, { passive: true });
    window.addEventListener('pointercancel', handlePointer, { passive: true });
    window.addEventListener('devicemotion', handleMotion);
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('pointermove', handlePointer);
      window.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('pointerup', handlePointer);
      window.removeEventListener('pointercancel', handlePointer);
      window.removeEventListener('devicemotion', handleMotion);
      window.removeEventListener('deviceorientation', handleOrientation);

      if (browserSensorRefreshRef.current !== undefined) {
        window.cancelAnimationFrame(browserSensorRefreshRef.current);
        browserSensorRefreshRef.current = undefined;
      }

      if (browserSensorTrailingRefreshRef.current !== undefined) {
        window.clearTimeout(browserSensorTrailingRefreshRef.current);
        browserSensorTrailingRefreshRef.current = undefined;
      }
    };
  }, [instrumentMode, sampleBrowserSensorState, selectedSourceId]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      selectedSourceId !== BROWSER_SENSOR_STREAM_SOURCE_ID ||
      instrumentMode !== 'live' ||
      sourceState.status === 'loading' ||
      sourceState.status === 'stale' ||
      sourceState.sourceId !== selectedSourceId ||
      sourceState.sourceMode !== 'live' ||
      sourceState.streamState === undefined
    ) {
      return;
    }

    const delayMs = browserSensorStaleRefreshDelayMs(sourceState.streamState.observedAt);

    if (delayMs === undefined) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSourceRefreshToken((currentToken) => currentToken + 1);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    instrumentMode,
    selectedSourceId,
    sourceState.sourceId,
    sourceState.sourceMode,
    sourceState.status,
    sourceState.streamState,
  ]);

  useEffect(() => {
    audioEngineRef.current?.applyParameters(viewState.audioParameters);
  }, [viewState.audioParameters]);

  useEffect(() => {
    if (captureSession?.status !== 'recording' || currentCaptureFrame === undefined) {
      return;
    }

    const frameKey = replayCaptureFrameKey(currentCaptureFrame);

    if (captureLastFrameKeyRef.current === frameKey) {
      return;
    }

    captureLastFrameKeyRef.current = frameKey;
    setCaptureSession((currentSession) => {
      if (currentSession?.status !== 'recording') {
        return currentSession;
      }

      const capturedFrame = prepareFrameForCaptureClock(
        currentSession,
        currentCaptureFrame,
        new Date().toISOString(),
      );

      return appendCapturedReplayFrame(currentSession, capturedFrame);
    });
  }, [captureSession?.status, currentCaptureFrame]);

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

  const selectSource = (nextSourceId: string) => {
    if (nextSourceId === selectedSourceId) {
      return;
    }

    const nextSource = sourceDefinition(nextSourceId);
    const nextMode = selectableModeForSource(nextSourceId, instrumentMode);
    const nextReplayArchive = archives.find((archive) =>
      archiveMatchesSource(archive, nextSource.kind),
    );

    sourceSequenceRef.current = undefined;
    setSelectedSourceId(nextSourceId);
    setInstrumentMode(nextMode);
    setFramePosition(0);
    setIsPlaying(false);

    if (nextReplayArchive !== undefined) {
      setArchiveId(nextReplayArchive.id);
    }

    if (nextMode !== 'replay') {
      markSourceLoading(setSourceState, nextSourceId, nextSource.displayName, nextMode);
    }
  };

  const selectInstrumentMode = (nextMode: InstrumentMode) => {
    if (nextMode === instrumentMode) {
      return;
    }

    if (!sourceSupportsMode(selectedSourceId, nextMode)) {
      return;
    }

    sourceSequenceRef.current = undefined;
    setInstrumentMode(nextMode);
    setIsPlaying(false);

    if (nextMode !== 'replay') {
      markSourceLoading(setSourceState, selectedSourceId, selectedSource.displayName, nextMode);
    }
  };

  const selectArchive = (nextArchiveId: string) => {
    setArchiveId(nextArchiveId);
    setFramePosition(0);
    setIsPlaying(false);
    setInstrumentMode('replay');
  };

  const refreshSource = () => {
    if (instrumentMode === 'replay') {
      return;
    }

    setIsPlaying(false);
    markSourceLoading(setSourceState, selectedSourceId, selectedSource.displayName, instrumentMode);
    setSourceRefreshToken((currentToken) => currentToken + 1);
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

  const enableBrowserSensors = async () => {
    publishBrowserSensorState(await requestBrowserSensorPermission(browserSensorStateRef.current));
    setSourceRefreshToken((currentToken) => currentToken + 1);
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

  const startCapture = () => {
    const startedAt = new Date().toISOString();

    if (currentCaptureFrame === undefined) {
      return;
    }

    captureLastFrameKeyRef.current = undefined;
    setCaptureExportFilename('');
    setCaptureSession(
      createReplayCaptureSessionForFrame({
        startedAt,
        frame: currentCaptureFrame,
      }),
    );
  };

  const stopCapture = () => {
    const stoppedAt = new Date().toISOString();

    setCaptureSession((currentSession) =>
      currentSession?.status === 'recording'
        ? stopReplayCaptureSession(currentSession, stoppedAt)
        : currentSession,
    );
  };

  const exportCapture = () => {
    if (captureSession === undefined || captureSession.frames.length === 0) {
      return;
    }

    const exportedAt = new Date().toISOString();
    const exportSession =
      captureSession.status === 'recording'
        ? stopReplayCaptureSession(captureSession, exportedAt)
        : captureSession;
    const snapshot = buildReplaySnapshot(exportSession, { createdAt: exportedAt });
    const filename = createReplayDownloadFilename(snapshot);

    downloadReplayJson(serializeReplaySnapshot(snapshot), filename);
    setCaptureSession(exportSession);
    setCaptureExportFilename(filename);
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

  const canRequestBrowserSensorPermission =
    selectedSourceId === BROWSER_SENSOR_STREAM_SOURCE_ID &&
    instrumentMode === 'live' &&
    browserSensorState.permissionRequestAvailable;

  return (
    <main className="instrument-shell" aria-labelledby="instrument-title">
      <section className="stage-panel" aria-label="Instrument surface">
        <InstrumentStage visualParameters={viewState.visualParameters} />
        <div className="stage-glow" style={stageGlowStyle} aria-hidden="true" />
      </section>

      <section className="voice-panel">
        <p className="eyebrow">World Instrument / stream score</p>
        <h1 id="instrument-title">Live streams tuned into light.</h1>
        <p className="lead">
          Registered sources pass through deterministic score, visual, sound, haptic, replay, and
          export paths while the controls stay secondary to the instrument surface.
        </p>
        <section
          className="stream-controls"
          aria-label="Stream controls"
          data-instrument-mode={instrumentMode}
          data-live-state={sourceDataStatus}
          data-provenance-mode={provenanceState.displayMode}
          data-provenance-status={provenanceState.status}
          data-provenance-source-id={provenanceState.sourceId}
          data-provenance-score-id={provenanceState.scoreId}
          data-provenance-score-version={provenanceState.scoreVersion}
          data-provenance-frame-age-ms={
            provenanceState.frameAgeMs === undefined
              ? 'unknown'
              : String(provenanceState.frameAgeMs)
          }
          data-source-id={selectedSourceId}
          data-source-mode={instrumentMode}
          data-source-state={sourceDataStatus}
        >
          <label className="source-picker">
            <span>Source</span>
            <select
              value={selectedSourceId}
              onChange={(event) => {
                selectSource(event.target.value);
              }}
            >
              {instrumentSourceDefinitions.map((definition) => (
                <option value={definition.id} key={definition.id}>
                  {definition.displayName}
                </option>
              ))}
            </select>
          </label>

          <div className="capability-strip" aria-label="Source capabilities">
            <span>{sourceCapabilitySummary(selectedSource)}</span>
            <span>
              {sourceHasCompatibleScore(selectedSourceId)
                ? sourceScoreLabel(selectedSourceId)
                : 'score pending'}
            </span>
          </div>

          <div className="mode-switch" role="group" aria-label="Input mode">
            <button
              type="button"
              onClick={() => {
                selectInstrumentMode('fixture');
              }}
              aria-pressed={instrumentMode === 'fixture'}
              disabled={!sourceSupportsMode(selectedSourceId, 'fixture')}
            >
              Fixture
            </button>
            <button
              type="button"
              onClick={() => {
                selectInstrumentMode('live');
              }}
              aria-pressed={instrumentMode === 'live'}
              disabled={!sourceSupportsMode(selectedSourceId, 'live')}
            >
              Live
            </button>
            <button
              type="button"
              onClick={() => {
                selectInstrumentMode('replay');
              }}
              aria-pressed={instrumentMode === 'replay'}
              disabled={!sourceSupportsMode(selectedSourceId, 'replay')}
            >
              Replay
            </button>
          </div>

          <section
            className="provenance-card"
            aria-label="Current data provenance"
            data-provenance-mode={provenanceState.displayMode}
            data-provenance-status={provenanceState.status}
            data-provenance-source-id={provenanceState.sourceId}
            data-provenance-score-id={provenanceState.scoreId}
          >
            <p className="provenance-summary" role="status" aria-live="polite">
              {provenanceState.summary}
            </p>
            <dl className="provenance-metrics" aria-label={provenanceState.ariaLabel}>
              <div>
                <dt>Mode</dt>
                <dd>{provenanceModeLabel(provenanceState.displayMode)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{provenanceStatusLabel(provenanceState.status)}</dd>
              </div>
              <div>
                <dt>Frame age</dt>
                <dd>{provenanceState.frameAgeLabel}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{provenanceState.sourceIdentity}</dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd>{provenanceState.scoreLabel}</dd>
              </div>
            </dl>
          </section>

          {instrumentMode !== 'replay' ? (
            <>
              <p className="source-status live-status mode-status" role="status" aria-live="polite">
                {sourceStatusLabel}
              </p>

              <div className="transport-controls">
                <button
                  type="button"
                  onClick={refreshSource}
                  disabled={sourceState.status === 'loading'}
                >
                  {sourceState.status === 'loading'
                    ? `Refreshing ${instrumentMode}`
                    : `Refresh ${instrumentMode}`}
                </button>
                {canRequestBrowserSensorPermission ? (
                  <button
                    type="button"
                    onClick={() => {
                      void enableBrowserSensors();
                    }}
                    disabled={browserSensorState.permissionState === 'granted'}
                  >
                    Enable device sensors
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="mode-status" role="status" aria-live="polite">
              {sourceStatusLabel}
            </p>
          )}

          <section className="replay-controls" aria-label="Replay controls">
            <label className="archive-picker">
              <span>Archive</span>
              <select
                value={archiveId}
                disabled={!sourceReplayAvailable}
                onChange={(event) => {
                  selectArchive(event.target.value);
                }}
              >
                {(sourceReplayAvailable ? sourceReplayArchives : archives).map((archive) => (
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
                disabled={instrumentMode !== 'replay' || !sourceReplayAvailable}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                onClick={restartReplay}
                disabled={instrumentMode !== 'replay' || !sourceReplayAvailable}
              >
                Restart
              </button>
              <button
                type="button"
                onClick={() => {
                  stepReplay(-1);
                }}
                disabled={
                  instrumentMode !== 'replay' || !sourceReplayAvailable || framePosition === 0
                }
                aria-label="Step backward"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  stepReplay(1);
                }}
                disabled={
                  instrumentMode !== 'replay' ||
                  !sourceReplayAvailable ||
                  framePosition === lastFramePosition
                }
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
                disabled={instrumentMode !== 'replay' || !sourceReplayAvailable}
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
            className="capture-controls"
            aria-label="Capture controls"
            data-capture-state={captureSession?.status ?? 'idle'}
            data-capture-frame-count={String(captureFrameCount)}
          >
            <div className="transport-controls">
              <button
                type="button"
                onClick={startCapture}
                disabled={captureIsRecording || currentCaptureFrame === undefined}
              >
                Start capture
              </button>
              <button type="button" onClick={stopCapture} disabled={!captureIsRecording}>
                Stop capture
              </button>
              <button type="button" onClick={exportCapture} disabled={!captureCanExport}>
                Export replay JSON
              </button>
            </div>
            <p aria-live="polite">{captureStatusLabel}</p>
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
          <span>{visibleFallbackActive ? 'replay fallback' : `${instrumentMode} mode`}</span>
          <span>{selectedSource.displayName}</span>
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

interface ProvenanceViewState {
  readonly displayMode: ProvenanceDisplayMode;
  readonly status: string;
  readonly sourceId: string;
  readonly sourceIdentity: string;
  readonly scoreId: string;
  readonly scoreVersion: string;
  readonly scoreLabel: string;
  readonly streamStatus: string;
  readonly frameAgeLabel: string;
  readonly frameAgeMs?: number;
  readonly summary: string;
  readonly ariaLabel: string;
  readonly captureMetadata: JsonObject;
}

function buildProvenanceViewState(options: {
  readonly activeArchive: ReplayArchive | undefined;
  readonly activeReplayFrame: ReplayFrame | undefined;
  readonly activeOutput: ReplayFrame['output'];
  readonly instrumentMode: InstrumentMode;
  readonly now: Date;
  readonly replayViewState: ReplayInstrumentFrameState;
  readonly selectedSourceId: string;
  readonly selectedSourceName: string;
  readonly sourceState: SourceUiState;
  readonly visibleFallbackActive: boolean;
}): ProvenanceViewState {
  const displayMode = options.visibleFallbackActive ? 'replay-fallback' : options.instrumentMode;
  const replayDriven = displayMode === 'replay' || displayMode === 'replay-fallback';
  const stream = replayDriven
    ? options.activeReplayFrame?.streams[0]
    : options.sourceState.streamState;
  const observedAt =
    stream?.observedAt ??
    (options.instrumentMode === 'replay' ? options.activeReplayFrame?.capturedAt : undefined) ??
    options.sourceState.frame?.observedAt;
  const receivedAt = stream?.receivedAt ?? options.sourceState.frame?.receivedAt;
  const sourceIdentity =
    stream?.source.label ??
    options.sourceState.frame?.sourceLabel ??
    (replayDriven ? options.activeArchive?.label : undefined) ??
    options.selectedSourceName;
  const sourceId =
    stream?.source.id ??
    (replayDriven ? options.activeArchive?.id : undefined) ??
    options.selectedSourceId;
  const status =
    displayMode === 'replay'
      ? 'ready'
      : options.instrumentMode === 'replay'
        ? 'unavailable'
        : options.sourceState.status;
  const streamStatus = stream?.status ?? options.sourceState.frame?.streamStatus ?? status;
  const scoreId =
    options.activeOutput?.scoreId ??
    options.activeReplayFrame?.output?.scoreId ??
    options.activeArchive?.snapshot.score.scoreId ??
    'unknown-score';
  const scoreVersion =
    options.activeOutput?.scoreVersion ??
    options.activeReplayFrame?.output?.scoreVersion ??
    options.activeArchive?.snapshot.score.scoreVersion ??
    'unknown-version';
  const scoreLabel = `${scoreId} ${scoreVersion}`;
  const frameAge = formatFrameAge(observedAt, options.now);
  const captureSourceMode = replayDriven ? 'replay' : options.instrumentMode;
  const summary = provenanceSummaryText({
    archiveLabel: options.activeArchive?.label,
    displayMode,
    frameAgeLabel: frameAge.label,
    sourceIdentity,
    sourceName: options.selectedSourceName,
    status,
  });
  const captureMetadata = {
    uiMode: displayMode,
    sourceMode: captureSourceMode,
    status,
    streamStatus,
    registeredSourceId: options.selectedSourceId,
    sourceName: options.selectedSourceName,
    sourceIdentity,
    sourceId,
    score: {
      scoreId,
      scoreVersion,
    },
    ...(stream === undefined
      ? {}
      : {
          streamId: stream.streamId,
          streamSourceId: stream.source.id,
          sourceKind: stream.source.kind,
          sourceLabel: stream.source.label ?? '',
        }),
    ...(observedAt === undefined ? {} : { observedAt }),
    ...(receivedAt === undefined ? {} : { receivedAt }),
    ...(frameAge.ms === undefined ? {} : { frameAgeMs: frameAge.ms }),
    ...(options.activeArchive === undefined || !replayDriven
      ? {}
      : {
          archiveId: options.activeArchive.id,
          archiveLabel: options.activeArchive.label,
          archiveFramePosition: options.replayViewState.framePosition,
        }),
    ...(displayMode !== 'replay-fallback'
      ? {}
      : {
          fallback: {
            fromMode: options.instrumentMode,
            reason:
              options.instrumentMode === 'replay'
                ? `${options.selectedSourceName} has no replay archive yet.`
                : options.sourceState.message,
          },
        }),
  } satisfies JsonObject;

  return {
    displayMode,
    status,
    sourceId,
    sourceIdentity,
    scoreId,
    scoreVersion,
    scoreLabel,
    streamStatus,
    frameAgeLabel: frameAge.label,
    ...(frameAge.ms === undefined ? {} : { frameAgeMs: frameAge.ms }),
    summary,
    ariaLabel: `${provenanceModeLabel(displayMode)} provenance: ${provenanceStatusLabel(
      status,
    )}, ${sourceIdentity}, ${scoreLabel}, ${frameAge.label}.`,
    captureMetadata,
  };
}

function provenanceSummaryText(options: {
  readonly archiveLabel: string | undefined;
  readonly displayMode: ProvenanceDisplayMode;
  readonly frameAgeLabel: string;
  readonly sourceIdentity: string;
  readonly sourceName: string;
  readonly status: string;
}): string {
  if (options.displayMode === 'replay-fallback') {
    return `Replay fallback is driving output from ${options.archiveLabel ?? options.sourceIdentity}; ${options.sourceName} is ${provenanceStatusLabel(
      options.status,
    ).toLowerCase()}. Frame ${options.frameAgeLabel}.`;
  }

  if (options.displayMode === 'replay') {
    return `Replay archive is driving output from ${options.sourceIdentity}. Frame ${options.frameAgeLabel}.`;
  }

  if (options.status === 'loading') {
    return `${provenanceModeLabel(options.displayMode)} ${options.sourceName} is loading the latest normalized frame.`;
  }

  return `${provenanceModeLabel(options.displayMode)} output from ${options.sourceIdentity}; ${provenanceStatusLabel(
    options.status,
  ).toLowerCase()}. Frame ${options.frameAgeLabel}.`;
}

function provenanceModeLabel(mode: ProvenanceDisplayMode): string {
  switch (mode) {
    case 'fixture':
      return 'Fixture';
    case 'live':
      return 'Live';
    case 'replay':
      return 'Replay';
    case 'replay-fallback':
      return 'Replay fallback';
  }
}

function provenanceStatusLabel(status: string): string {
  switch (status) {
    case 'error':
      return 'Error';
    case 'loading':
      return 'Loading';
    case 'offline':
      return 'Offline';
    case 'stale':
      return 'Stale';
    case 'unavailable':
      return 'Unavailable';
    default:
      return 'Ready';
  }
}

function formatFrameAge(
  observedAt: string | undefined,
  now: Date,
): {
  readonly label: string;
  readonly ms?: number;
} {
  if (observedAt === undefined) {
    return { label: 'age unknown' };
  }

  const observedAtMs = Date.parse(observedAt);

  if (Number.isNaN(observedAtMs)) {
    return { label: 'age unknown' };
  }

  const ageMs = Math.max(0, now.getTime() - observedAtMs);
  const totalSeconds = Math.floor(ageMs / 1000);

  if (totalSeconds < 60) {
    return { label: 'less than 1 min old', ms: ageMs };
  }

  const totalMinutes = Math.floor(totalSeconds / 60);

  if (totalMinutes < 60) {
    return {
      label: `${String(totalMinutes)} ${totalMinutes === 1 ? 'min' : 'min'} old`,
      ms: ageMs,
    };
  }

  const totalHours = Math.floor(totalMinutes / 60);

  if (totalHours < 48) {
    return {
      label: `${String(totalHours)} ${totalHours === 1 ? 'hr' : 'hr'} old`,
      ms: ageMs,
    };
  }

  const totalDays = Math.floor(totalHours / 24);

  return {
    label: `${String(totalDays)} ${totalDays === 1 ? 'day' : 'days'} old`,
    ms: ageMs,
  };
}

function sourceStatusText(options: {
  readonly sourceState: SourceUiState;
  readonly instrumentMode: InstrumentMode;
  readonly sourceName: string;
  readonly sourceReplayAvailable: boolean;
  readonly visibleFallbackActive: boolean;
}): string {
  if (options.instrumentMode === 'replay') {
    return options.sourceReplayAvailable
      ? `${options.sourceName} replay archive is driving the instrument.`
      : `${options.sourceName} has no replay archive yet. Showing deterministic replay fallback.`;
  }

  if (options.sourceState.status === 'loading') {
    return options.sourceState.message;
  }

  const fallbackSuffix = options.visibleFallbackActive
    ? ' Showing deterministic replay fallback.'
    : '';

  return `${options.sourceState.message}${fallbackSuffix}`;
}

function captureStatusText(
  session: ReplayCaptureSession | undefined,
  exportFilename: string,
): string {
  if (session === undefined) {
    return 'Capture ready for live or replay frames.';
  }

  const frameLabel = `${String(session.frames.length)} ${
    session.frames.length === 1 ? 'frame' : 'frames'
  }`;

  if (exportFilename.length > 0) {
    return `Exported ${frameLabel} to ${exportFilename}.`;
  }

  if (session.status === 'recording') {
    return `Recording ${frameLabel} into a replay archive.`;
  }

  return `Capture stopped with ${frameLabel} ready to export.`;
}

function downloadReplayJson(contents: string, filename: string): void {
  const blob = new Blob([contents], { type: 'application/replay+json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

function markSourceLoading(
  setSourceState: Dispatch<SetStateAction<SourceUiState>>,
  sourceId: string,
  sourceName: string,
  sourceMode: Exclude<InstrumentMode, 'replay'>,
): void {
  setSourceState((currentState) => {
    const canPreserveFrame =
      currentState.sourceId === sourceId &&
      currentState.sourceMode === sourceMode &&
      currentState.frame !== undefined;

    return {
      sourceId,
      sourceName,
      sourceMode,
      status: 'loading',
      message: canPreserveFrame
        ? `Refreshing ${sourceName} ${sourceMode} input...`
        : `Loading ${sourceName} ${sourceMode} input...`,
      ...(canPreserveFrame
        ? {
            frame: currentState.frame,
            seed: currentState.frame.seed,
            ...(currentState.streamState === undefined
              ? {}
              : { streamState: currentState.streamState }),
          }
        : {}),
    };
  });
}

function mergeSourceUiState(
  currentState: SourceUiState,
  nextState: SourceReadState,
): SourceUiState {
  if (
    (nextState.status === 'error' ||
      nextState.status === 'offline' ||
      nextState.status === 'unavailable') &&
    nextState.frame === undefined &&
    currentState.frame !== undefined &&
    currentState.sourceId === nextState.sourceId &&
    currentState.sourceMode === nextState.sourceMode
  ) {
    return {
      ...nextState,
      frame: currentState.frame,
      seed: currentState.frame.seed,
      ...(currentState.streamState === undefined ? {} : { streamState: currentState.streamState }),
    };
  }

  return nextState;
}

function archiveMatchesSource(archive: ReplayArchive, sourceKind: string): boolean {
  return archive.snapshot.frames.some((frame) =>
    frame.streams.some((stream) => stream.source.kind === sourceKind),
  );
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
