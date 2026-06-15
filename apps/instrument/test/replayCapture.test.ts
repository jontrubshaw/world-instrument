import { parseReplaySnapshot } from '@world-instrument/core';
import { describe, expect, it } from 'vitest';

import { readLiveWeatherFrame } from '../src/liveWeather.ts';
import {
  appendCapturedFrame,
  createCapturedLiveFrame,
  createCapturedReplayFrame,
  createReplaySnapshotFromCapturedFrames,
  replaySnapshotDownloadFilename,
  serializeReplaySnapshot,
} from '../src/replayCapture.ts';
import {
  createReplayScoreSequence,
  evaluateReplayFrame,
  loadReplayArchives,
  type ReplayArchive,
} from '../src/replayArchive.ts';

describe('instrument replay capture export', () => {
  it('exports played replay frames as a parser-valid deterministic replay archive', () => {
    const archive = firstReplayArchive();
    const capturedFrames = [
      createCapturedReplayFrame(archive, 0, evaluateReplayFrame(archive, 0).output),
      createCapturedReplayFrame(archive, 1, evaluateReplayFrame(archive, 1).output),
      createCapturedReplayFrame(archive, 0, evaluateReplayFrame(archive, 0).output),
    ];

    const snapshot = createReplaySnapshotFromCapturedFrames(capturedFrames, {
      createdAt: '2026-06-15T04:45:00.000Z',
      snapshotId: 'generated-weather-session-test',
      title: 'Generated replay capture test',
    });
    const reparsedSnapshot = parseReplaySnapshot(JSON.parse(serializeReplaySnapshot(snapshot)));
    const exportedArchive: ReplayArchive = {
      id: 'generated-export',
      label: 'Generated export',
      snapshot: reparsedSnapshot,
    };

    expect(reparsedSnapshot).toMatchObject({
      schemaVersion: 'replay-snapshot.v1',
      snapshotId: 'generated-weather-session-test',
      score: {
        scoreId: 'weather-score',
        scoreVersion: '1.0.0',
      },
      metadata: {
        captureVersion: 'replay-capture.v1',
        capturedBy: 'world-instrument.instrument-app',
        frameCount: 3,
        modes: ['replay'],
      },
    });
    expect(reparsedSnapshot.frames.map((frame) => frame.seed)).toEqual([
      'weather-score-v1:london:0',
      'weather-score-v1:london:1',
      'weather-score-v1:london:0',
    ]);
    expect(createReplayScoreSequence(exportedArchive)).toEqual(
      reparsedSnapshot.frames.map((frame) => frame.output),
    );
    expect(replaySnapshotDownloadFilename(reparsedSnapshot)).toBe(
      'generated-weather-session-test.replay.json',
    );
  });

  it('captures live weather frames with provenance and replays the same score output', async () => {
    const liveState = await readLiveWeatherFrame({
      fetchWeather: createOpenMeteoFetch(),
      now: new Date('2026-06-14T21:05:00.000Z'),
      online: true,
    });

    if (liveState.frame === undefined || liveState.streamState === undefined) {
      throw new Error('Expected live weather test data to produce a generated frame.');
    }

    const capturedLiveFrame = createCapturedLiveFrame(liveState.streamState, liveState.frame);
    const snapshot = createReplaySnapshotFromCapturedFrames([capturedLiveFrame], {
      createdAt: '2026-06-15T04:46:00.000Z',
      snapshotId: 'generated-live-weather-session-test',
    });
    const exportedArchive: ReplayArchive = {
      id: 'generated-live-export',
      label: 'Generated live export',
      snapshot,
    };

    expect(snapshot.frames[0]).toMatchObject({
      frameIndex: 0,
      elapsedMs: 0,
      capturedAt: '2026-06-14T21:00:00.000Z',
      seed: 'world-instrument-live-weather-v1',
      streams: [
        {
          streamId: 'weather:london-uk',
          status: 'ok',
          metadata: {
            provider: 'open-meteo',
            mode: 'live',
            condition: 'overcast',
          },
        },
      ],
      output: {
        scoreId: 'weather-score',
        scoreVersion: '1.0.0',
        metadata: {
          streamId: 'weather:london-uk',
          condition: 'overcast',
        },
      },
    });
    expect(snapshot.metadata).toMatchObject({
      title: 'Generated weather session',
      captureVersion: 'replay-capture.v1',
      modes: ['live'],
      sources: [
        {
          mode: 'live',
          streamId: 'weather:london-uk',
          sourceKind: 'weather',
          sourceLabel: 'London, UK weather',
        },
      ],
    });
    expect(createReplayScoreSequence(exportedArchive)).toEqual(
      snapshot.frames.map((frame) => frame.output),
    );
  });

  it('does not append duplicate consecutive generated frames', () => {
    const archive = firstReplayArchive();
    const capturedFrame = createCapturedReplayFrame(
      archive,
      0,
      evaluateReplayFrame(archive, 0).output,
    );

    expect(appendCapturedFrame([capturedFrame], capturedFrame)).toEqual([capturedFrame]);
    expect(
      appendCapturedFrame(
        [capturedFrame],
        createCapturedReplayFrame(archive, 1, evaluateReplayFrame(archive, 1).output),
      ),
    ).toHaveLength(2);
  });
});

function firstReplayArchive(): ReplayArchive {
  const archive = loadReplayArchives()[0];

  if (archive === undefined) {
    throw new Error('Expected at least one replay archive.');
  }

  return archive;
}

function createOpenMeteoFetch() {
  return () =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          latitude: 51.5,
          longitude: -0.12,
          timezone: 'GMT',
          current: {
            time: '2026-06-14T21:00',
            temperature_2m: 18.4,
            apparent_temperature: 17.9,
            relative_humidity_2m: 72,
            precipitation: 0.1,
            rain: 0,
            weather_code: 3,
            cloud_cover: 86,
            surface_pressure: 1012.4,
            wind_speed_10m: 6.8,
            wind_direction_10m: 248,
          },
        }),
    });
}
