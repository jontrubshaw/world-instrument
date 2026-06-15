import { parseReplaySnapshot, type JsonObject } from '@world-instrument/core';
import { describe, expect, it } from 'vitest';

import {
  appendCapturedReplayFrame,
  buildReplaySnapshot,
  createReplayCaptureFrameFromArchive,
  createReplayCaptureSession,
  createReplayCaptureSessionForFrame,
  createReplayCaptureSessionId,
  createReplayDownloadFilename,
  prepareFrameForCaptureClock,
  replayCaptureFrameKey,
  serializeReplaySnapshot,
  type ReplayCaptureFrameInput,
} from '../src/replayCapture.ts';
import {
  createReplayScoreSequence,
  evaluateReplayFrame,
  loadReplayArchives,
  type ReplayArchive,
} from '../src/replayArchive.ts';

describe('instrument replay capture', () => {
  it('exports captured generated frames as a parser-compatible replay snapshot', () => {
    const archive = firstReplayArchive();
    const session = createReplayCaptureSession({
      sessionId: 'captured-replay-weather-2026-06-14T21-00-00Z',
      title: 'Captured replay validation',
      startedAt: '2026-06-14T22:00:00.000Z',
    });
    const capturedSession = [0, 1].reduce(
      (currentSession, position) =>
        appendCapturedReplayFrame(currentSession, captureInputForReplayFrame(archive, position)),
      session,
    );
    const snapshot = buildReplaySnapshot(capturedSession, {
      createdAt: '2026-06-14T22:45:00.000Z',
    });
    const parsed = parseReplaySnapshot(JSON.parse(serializeReplaySnapshot(snapshot)));

    expect(parsed).toEqual(snapshot);
    expect(parsed).toMatchObject({
      schemaVersion: 'replay-snapshot.v1',
      snapshotId: 'captured-replay-weather-2026-06-14T21-00-00Z',
      score: {
        scoreId: 'weather-score',
        scoreVersion: '1.0.0',
      },
      frames: [
        {
          frameIndex: 0,
          elapsedMs: 0,
          seed: 'weather-score-v1:london:0',
        },
        {
          frameIndex: 1,
          elapsedMs: 15000,
          seed: 'weather-score-v1:london:1',
        },
      ],
    });
    expect(parsed.frames[1]?.elapsedMs).toBeGreaterThan(0);
    expect(parsed.frames.map((frame) => frame.output?.trace?.[0]?.value)).toEqual([
      '8f5c7a72',
      '6c2d4560',
    ]);
    expect(parsed.metadata).toMatchObject({
      fixture: false,
      mode: 'captured',
      capture: {
        frameCount: 2,
        sourceMode: 'replay',
      },
      score: {
        scoreId: 'weather-score',
        scoreVersion: '1.0.0',
      },
    });
    expect(metadataFrames(parsed.metadata)).toMatchObject([
      {
        frameIndex: 0,
        inputHash: '8f5c7a72',
        visualSignature: '8f5c7a72',
        sourceMode: 'replay',
      },
      {
        frameIndex: 1,
        inputHash: '6c2d4560',
        visualSignature: '6c2d4560',
        sourceMode: 'replay',
      },
    ]);
  });

  it('replays an exported capture into the same score sequence', () => {
    const archive = firstReplayArchive();
    const session = createReplayCaptureSession({
      sessionId: 'captured-replay-round-trip',
      title: 'Captured replay round trip',
      startedAt: '2026-06-14T21:00:00.000Z',
    });
    const capturedSession = [0, 1, 2].reduce(
      (currentSession, position) =>
        appendCapturedReplayFrame(currentSession, captureInputForReplayFrame(archive, position)),
      session,
    );
    const snapshot = buildReplaySnapshot(capturedSession, {
      createdAt: '2026-06-14T22:45:00.000Z',
    });
    const capturedArchive: ReplayArchive = {
      id: 'captured-replay-round-trip',
      label: 'Captured replay round trip',
      snapshot,
    };

    expect(createReplayScoreSequence(capturedArchive)).toEqual(
      snapshot.frames.map((frame) => frame.output),
    );
    expect(
      createReplayScoreSequence(capturedArchive).map(
        (output) => output.trace?.find((entry) => entry.key === 'inputHash')?.value,
      ),
    ).toEqual(['8f5c7a72', '6c2d4560', '6247890f']);
  });

  it('builds a captureable replay frame from the currently rendered archive view', () => {
    const archive = firstReplayArchive();
    const viewState = evaluateReplayFrame(archive, 0);
    const captureInput = createReplayCaptureFrameFromArchive({ archive, viewState });

    expect(captureInput).toMatchObject({
      sourceMode: 'replay',
      frameIndex: 0,
      capturedAt: '2026-06-14T21:00:00.000Z',
      elapsedMs: 0,
      seed: 'weather-score-v1:london:0',
      visualSignature: '8f5c7a72',
      audioSignature: '8f5c7a72',
      hapticSignature: '8f5c7a72',
      sourceLabel: 'London, UK weather',
      statusLabel: 'overcast archive frame 1/3',
    });
  });

  it('creates stable capture ids and replay JSON filenames', () => {
    const sessionId = createReplayCaptureSessionId('2026-06-14T21:05:00.000Z', 'live');
    const session = appendCapturedReplayFrame(
      createReplayCaptureSession({
        sessionId,
        title: 'Captured live weather session',
        startedAt: '2026-06-14T21:05:00.000Z',
      }),
      captureInputForReplayFrame(firstReplayArchive(), 0),
    );
    const snapshot = buildReplaySnapshot(session, {
      createdAt: '2026-06-14T21:06:00.000Z',
    });

    expect(sessionId).toBe('captured-live-weather-2026-06-14T21-05-00Z');
    expect(createReplayDownloadFilename(snapshot)).toBe(
      'world-instrument-captured-live-weather-2026-06-14T21-05-00Z.replay.json',
    );
  });

  it('keys capture frames by persisted provenance changes without clock-only churn', () => {
    const replayInput = captureInputForReplayFrame(firstReplayArchive(), 0);
    const readyLiveInput = {
      ...replayInput,
      sourceMode: 'live' as const,
      provenance: {
        uiMode: 'live',
        sourceMode: 'live',
        status: 'ready',
        streamStatus: 'ready',
        registeredSourceId: 'weather.open-meteo',
        sourceIdentity: 'London, UK weather',
        sourceId: 'weather.open-meteo:london-uk',
        frameAgeMs: 1000,
      },
    } satisfies ReplayCaptureFrameInput;
    const agedLiveInput = {
      ...readyLiveInput,
      provenance: {
        ...readyLiveInput.provenance,
        frameAgeMs: 16000,
      },
    } satisfies ReplayCaptureFrameInput;
    const offlineLiveInput = {
      ...readyLiveInput,
      provenance: {
        ...readyLiveInput.provenance,
        uiMode: 'replay-fallback',
        sourceMode: 'replay',
        status: 'offline',
        streamStatus: 'ready',
      },
    } satisfies ReplayCaptureFrameInput;

    expect(replayCaptureFrameKey(agedLiveInput)).toBe(replayCaptureFrameKey(readyLiveInput));
    expect(replayCaptureFrameKey(offlineLiveInput)).not.toBe(replayCaptureFrameKey(readyLiveInput));
  });

  it('derives capture session metadata from replay fallback frames', () => {
    const archive = firstReplayArchive();
    const replayFallbackFrame = captureInputForReplayFrame(archive, 0);
    const session = createReplayCaptureSessionForFrame({
      startedAt: '2026-06-14T21:05:00.000Z',
      frame: replayFallbackFrame,
    });

    expect(session).toMatchObject({
      sessionId: 'captured-replay-weather-2026-06-14T21-05-00Z',
      title: 'London, UK weather generated replay capture',
      startedAt: '2026-06-14T21:05:00.000Z',
    });
    expect(session.sessionId).not.toContain('sensor');
  });

  it('uses capture-clock elapsed times for live frames with older observations', () => {
    const session = createReplayCaptureSession({
      sessionId: 'captured-live-clock-regression',
      title: 'Captured live clock regression',
      startedAt: '2026-06-14T21:05:00.000Z',
    });
    const replayInput = captureInputForReplayFrame(firstReplayArchive(), 0);
    const liveInput = {
      ...replayInput,
      sourceMode: 'live' as const,
      capturedAt: '2026-06-14T20:00:00.000Z',
      streams: replayInput.streams.map((stream) => ({
        ...stream,
        observedAt: '2026-06-14T20:00:00.000Z',
      })),
    };
    const capturedSession = [
      prepareFrameForCaptureClock(session, liveInput, '2026-06-14T21:05:12.000Z'),
      prepareFrameForCaptureClock(
        session,
        {
          ...liveInput,
          frameIndex: 1,
          streams: liveInput.streams.map((stream) => ({
            ...stream,
            sequence: 1,
          })),
        },
        '2026-06-14T21:05:45.000Z',
      ),
    ].reduce(
      (currentSession, frameInput) => appendCapturedReplayFrame(currentSession, frameInput),
      session,
    );
    const frame = capturedSession.frames[0];
    const firstStream = frame?.streams[0];

    expect(capturedSession.frames.map((capturedFrame) => capturedFrame.elapsedMs)).toEqual([
      12000, 45000,
    ]);
    expect(frame).toMatchObject({
      sourceMode: 'live',
      capturedAt: '2026-06-14T21:05:12.000Z',
      elapsedMs: 12000,
    });
    expect(frame?.output.generatedAt).toBe('2026-06-14T21:05:12.000Z');
    expect(firstStream?.observedAt).toBe('2026-06-14T20:00:00.000Z');
  });

  it('uses capture-clock elapsed times for fixture frames with older observations', () => {
    const session = createReplayCaptureSession({
      sessionId: 'captured-fixture-clock-regression',
      title: 'Captured fixture clock regression',
      startedAt: '2026-06-14T21:05:00.000Z',
    });
    const replayInput = captureInputForReplayFrame(firstReplayArchive(), 0);
    const preparedFrame = prepareFrameForCaptureClock(
      session,
      {
        ...replayInput,
        sourceMode: 'fixture',
        capturedAt: '2026-06-14T20:00:00.000Z',
        streams: replayInput.streams.map((stream) => ({
          ...stream,
          observedAt: '2026-06-14T20:00:00.000Z',
        })),
      },
      '2026-06-14T21:05:30.000Z',
    );
    const capturedSession = appendCapturedReplayFrame(session, preparedFrame);
    const snapshot = buildReplaySnapshot(capturedSession, {
      createdAt: '2026-06-14T21:06:00.000Z',
    });

    expect(preparedFrame).toMatchObject({
      sourceMode: 'fixture',
      capturedAt: '2026-06-14T21:05:30.000Z',
      elapsedMs: 30000,
    });
    expect(preparedFrame.output.generatedAt).toBe('2026-06-14T21:05:30.000Z');
    expect(capturedSession.frames[0]?.elapsedMs).toBe(30000);
    expect(parseReplaySnapshot(snapshot).frames[0]).toMatchObject({
      capturedAt: '2026-06-14T21:05:30.000Z',
      elapsedMs: 30000,
      output: {
        generatedAt: '2026-06-14T21:05:30.000Z',
      },
    });
    expect(metadataFrames(snapshot.metadata)[0]).toMatchObject({
      sourceMode: 'fixture',
      capturedAt: '2026-06-14T21:05:30.000Z',
      elapsedMs: 30000,
    });
  });

  it('rescores live frames after applying the capture clock', () => {
    const session = createReplayCaptureSession({
      sessionId: 'captured-live-rescore-regression',
      title: 'Captured live rescore regression',
      startedAt: '2026-06-14T21:05:00.000Z',
    });
    const replayInput = captureInputForReplayFrame(firstReplayArchive(), 0);
    const preparedFrame = prepareFrameForCaptureClock(
      session,
      {
        ...replayInput,
        sourceMode: 'live',
        capturedAt: '2026-06-14T20:00:00.000Z',
        streams: replayInput.streams.map((stream) => ({
          ...stream,
          observedAt: '2026-06-14T20:00:00.000Z',
        })),
      },
      '2026-06-14T21:05:12.000Z',
    );
    const capturedSession = appendCapturedReplayFrame(session, preparedFrame);
    const snapshot = buildReplaySnapshot(capturedSession, {
      createdAt: '2026-06-14T21:06:00.000Z',
    });
    const capturedArchive: ReplayArchive = {
      id: 'captured-live-rescore-regression',
      label: 'Captured live rescore regression',
      snapshot,
    };

    expect(preparedFrame.output.generatedAt).toBe(preparedFrame.capturedAt);
    expect(parseReplaySnapshot(snapshot).frames[0]?.output?.generatedAt).toBe(
      '2026-06-14T21:05:12.000Z',
    );
    expect(createReplayScoreSequence(capturedArchive)).toEqual(
      snapshot.frames.map((frame) => frame.output),
    );
  });
});

function firstReplayArchive(): ReplayArchive {
  const archive = loadReplayArchives()[0];

  if (archive === undefined) {
    throw new Error('Expected at least one replay archive.');
  }

  return archive;
}

function captureInputForReplayFrame(
  archive: ReplayArchive,
  position: number,
): ReplayCaptureFrameInput {
  const frame = archive.snapshot.frames[position];
  const instrumentState = evaluateReplayFrame(archive, position);

  if (frame === undefined) {
    throw new Error(`Expected replay frame ${String(position)}.`);
  }

  return {
    sourceMode: 'replay',
    frameIndex: instrumentState.frameIndex,
    capturedAt: frame.capturedAt,
    elapsedMs: frame.elapsedMs,
    streams: frame.streams,
    seed: frame.seed,
    output: instrumentState.output,
    visualSignature: instrumentState.visualParameters.signature,
    audioSignature: instrumentState.audioParameters.signature,
    hapticSignature: instrumentState.hapticPattern.signature,
    sourceLabel: instrumentState.sourceLabel,
    statusLabel: instrumentState.statusLabel,
  };
}

function metadataFrames(metadata: JsonObject | undefined): readonly JsonObject[] {
  const frames = metadata?.frames;

  if (!Array.isArray(frames)) {
    throw new Error('Expected captured frame metadata.');
  }

  return frames as readonly JsonObject[];
}
