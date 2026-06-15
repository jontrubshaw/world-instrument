import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('loads the instrument shell', async ({ page }) => {
  await page.route('https://api.open-meteo.com/v1/forecast**', async (route) => {
    const observedAt = new Date().toISOString();

    await route.fulfill({
      json: {
        latitude: 51.5,
        longitude: -0.12,
        timezone: 'GMT',
        current: {
          time: observedAt,
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
      },
    });
  });
  await page.addInitScript(() => {
    const vibrationLog: VibratePattern[] = [];

    Object.defineProperty(window, '__worldInstrumentVibrations', {
      configurable: true,
      value: vibrationLog,
    });
    Object.defineProperty(window.navigator, 'vibrate', {
      configurable: true,
      value: (pattern: VibratePattern) => {
        vibrationLog.push(pattern);

        return true;
      },
    });
  });

  await page.goto('/');

  await expect(page).toHaveTitle('World Instrument');
  await expect(page.getByRole('heading', { name: 'Live streams tuned into light.' })).toBeVisible();

  const canvas = page.getByTestId('instrument-canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => element.clientWidth > 0)).toBe(true);
  await expect.poll(() => canvas.evaluate((element) => element.clientHeight > 0)).toBe(true);

  const streamControls = page.getByRole('region', { name: 'Stream controls' });
  await expect(streamControls).toBeVisible();
  await expect(streamControls).toHaveAttribute('data-instrument-mode', 'live');
  await expect(streamControls).toHaveAttribute('data-live-state', 'ready');
  await expect(streamControls).toHaveAttribute('data-provenance-mode', 'live');
  await expect(streamControls).toHaveAttribute('data-provenance-status', 'ready');
  await expect(streamControls).toHaveAttribute(
    'data-provenance-source-id',
    'weather.open-meteo:london-uk',
  );
  await expect(streamControls).toHaveAttribute('data-provenance-score-id', 'weather-score');
  await expect(streamControls).toHaveAttribute('data-source-id', 'weather.open-meteo');
  await expect(streamControls).toHaveAttribute('data-source-state', 'ready');
  const provenance = page.getByRole('region', { name: 'Current data provenance' });
  await expect(provenance).toBeVisible();
  await expect(provenance.locator('.provenance-summary')).toContainText(
    'Live output from London, UK weather via weather-score 1.0.0; ready.',
  );
  await expect(
    provenance.locator('.provenance-metrics dd').getByText('less than 1 min old'),
  ).toBeVisible();
  const sourceSelector = streamControls.locator('.source-picker select');
  await expect(sourceSelector).toHaveValue('weather.open-meteo');
  await expect(streamControls.locator('.live-status')).toHaveText(
    'Live weather is driving the instrument.',
  );
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await page.waitForTimeout(50);
  await expect(streamControls).toHaveAttribute('data-instrument-mode', 'live');
  await expect(streamControls).toHaveAttribute('data-live-state', 'ready');
  await expect(streamControls.locator('.live-status')).toHaveText(
    'Live weather is driving the instrument.',
  );
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.scoreId))
    .toBe('weather-score');
  await expect.poll(() => canvas.evaluate((element) => element.dataset.scoreFrameIndex)).toBe('0');
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.weatherCondition))
    .toBe('overcast');

  await sourceSelector.selectOption('sensor.browser-interaction');
  await expect(streamControls).toHaveAttribute('data-source-id', 'sensor.browser-interaction');
  await expect(streamControls).toHaveAttribute('data-source-mode', 'live');
  await expect
    .poll(async () => {
      await page.evaluate(() => {
        window.dispatchEvent(
          new PointerEvent('pointerdown', {
            clientX: 520,
            clientY: 240,
            buttons: 1,
            pressure: 0.7,
            pointerType: 'touch',
          }),
        );
      });

      return canvas.evaluate((element) => element.dataset.weatherCondition);
    })
    .toBe('sensor-touch');
  await expect
    .poll(async () => {
      await page.evaluate(() => {
        window.dispatchEvent(
          new PointerEvent('pointercancel', {
            clientX: 520,
            clientY: 240,
            buttons: 0,
            pressure: 0,
            pointerType: 'touch',
          }),
        );
      });

      return canvas.evaluate((element) => element.dataset.weatherCondition);
    })
    .toBe('sensor-fallback');
  await expect(streamControls).toHaveAttribute('data-source-state', 'ready');
  await expect(streamControls).toHaveAttribute('data-provenance-mode', 'live');
  await expect(streamControls).toHaveAttribute('data-provenance-status', 'ready');
  await expect(streamControls).toHaveAttribute(
    'data-provenance-source-id',
    'sensor.browser-interaction:local-browser',
  );
  await expect(streamControls).toHaveAttribute('data-provenance-score-id', 'browser-sensor-score');
  await expect(provenance.locator('.provenance-summary')).toContainText(
    'Live output from Local browser sensor via browser-sensor-score 1.0.0; ready.',
  );
  await expect(streamControls.locator('.source-status')).toHaveText(
    'Browser sensor / interaction pointer fallback is driving the instrument; motion/orientation sensors are unavailable or waiting for permission.',
  );
  await expect(page.getByText('live mode', { exact: true })).toBeVisible();

  const sensorCaptureControls = page.getByRole('region', { name: 'Capture controls' });
  await page.getByRole('button', { name: 'Start capture' }).click();
  await expect(sensorCaptureControls).toHaveAttribute('data-capture-state', 'recording');
  await expect
    .poll(() =>
      sensorCaptureControls.evaluate((element) =>
        Number(element.getAttribute('data-capture-frame-count')),
      ),
    )
    .toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: 'Stop capture' }).click();
  const sensorDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export replay JSON' }).click();
  const sensorDownload = await sensorDownloadPromise;
  const sensorDownloadPath = await sensorDownload.path();

  expect(sensorDownload.suggestedFilename()).toMatch(
    /^world-instrument-captured-live-sensor-.*\.replay\.json$/,
  );
  const sensorReplay = JSON.parse(await readFile(sensorDownloadPath, 'utf8')) as {
    readonly schemaVersion: string;
    readonly frames: readonly {
      readonly seed: string;
      readonly streams: readonly {
        readonly source: {
          readonly kind: string;
        };
        readonly metadata?: {
          readonly mode?: string;
          readonly provider?: string;
        };
      }[];
    }[];
    readonly metadata: {
      readonly capture: {
        readonly sourceMode: string;
      };
      readonly frames: readonly {
        readonly provenance: {
          readonly registeredSourceId: string;
          readonly sourceIdentity: string;
          readonly sourceMode: string;
          readonly status: string;
          readonly uiMode: string;
        };
      }[];
      readonly sources: readonly {
        readonly kind: string;
      }[];
    };
  };

  expect(sensorReplay.schemaVersion).toBe('replay-snapshot.v1');
  expect(
    sensorReplay.frames.some(
      (frame) =>
        frame.seed === 'world-instrument-live-browser-sensor-v1' &&
        frame.streams.some(
          (stream) =>
            stream.source.kind === 'sensor' &&
            stream.metadata?.provider === 'browser-sensor' &&
            stream.metadata.mode === 'live',
        ),
    ),
  ).toBe(true);
  expect(sensorReplay.metadata).toMatchObject({
    capture: {
      sourceMode: 'live',
    },
    sources: [
      {
        kind: 'sensor',
      },
    ],
  });
  expect(
    sensorReplay.metadata.frames.some(
      (frame) =>
        frame.provenance.registeredSourceId === 'sensor.browser-interaction' &&
        frame.provenance.sourceIdentity === 'Local browser sensor' &&
        frame.provenance.sourceMode === 'live' &&
        frame.provenance.status === 'ready' &&
        frame.provenance.uiMode === 'live',
    ),
  ).toBe(true);

  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(streamControls).toHaveAttribute('data-source-id', 'sensor.browser-interaction');
  await expect(streamControls).toHaveAttribute('data-instrument-mode', 'replay');
  await expect(streamControls).toHaveAttribute('data-provenance-mode', 'replay-fallback');
  await expect(streamControls).toHaveAttribute('data-provenance-status', 'unavailable');
  await expect(provenance.locator('.provenance-summary')).toContainText(
    'Replay fallback is driving output from London weather archive via weather-score 1.0.0; Browser sensor / interaction is unavailable.',
  );
  await expect(streamControls.locator('.mode-status')).toHaveText(
    'Browser sensor / interaction has no replay archive yet. Showing deterministic replay fallback.',
  );
  await expect(page.getByLabel('Archive')).toBeDisabled();

  await page.getByRole('button', { name: 'Start capture' }).click();
  await expect(sensorCaptureControls).toHaveAttribute('data-capture-state', 'recording');
  await expect(sensorCaptureControls).toHaveAttribute('data-capture-frame-count', '1');
  await page.getByRole('button', { name: 'Stop capture' }).click();
  await expect(sensorCaptureControls).toHaveAttribute('data-capture-state', 'ready');
  const sensorReplayFallbackDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export replay JSON' }).click();
  const sensorReplayFallbackDownload = await sensorReplayFallbackDownloadPromise;
  const sensorReplayFallbackDownloadPath = await sensorReplayFallbackDownload.path();

  expect(JSON.parse(await readFile(sensorReplayFallbackDownloadPath, 'utf8'))).toMatchObject({
    schemaVersion: 'replay-snapshot.v1',
    metadata: {
      capture: {
        sourceMode: 'replay',
      },
      frames: [
        {
          provenance: {
            registeredSourceId: 'sensor.browser-interaction',
            sourceName: 'Browser sensor / interaction',
            sourceMode: 'replay',
            status: 'unavailable',
            uiMode: 'replay-fallback',
            fallback: {
              fromMode: 'replay',
              reason: 'Browser sensor / interaction has no replay archive yet.',
            },
          },
        },
      ],
    },
  });

  await sourceSelector.selectOption('weather.open-meteo');
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await expect(streamControls).toHaveAttribute('data-source-id', 'weather.open-meteo');
  await expect(streamControls).toHaveAttribute('data-source-mode', 'live');
  await expect(streamControls).toHaveAttribute('data-source-state', 'ready');
  await expect(streamControls).toHaveAttribute('data-provenance-mode', 'live');
  await expect(streamControls).toHaveAttribute('data-provenance-status', 'ready');

  const captureControls = page.getByRole('region', { name: 'Capture controls' });
  await expect(captureControls).toBeVisible();
  await page.getByRole('button', { name: 'Start capture' }).click();
  await expect(captureControls).toHaveAttribute('data-capture-state', 'recording');
  await expect(captureControls).toHaveAttribute('data-capture-frame-count', '1');
  await page.getByRole('button', { name: 'Stop capture' }).click();
  await expect(captureControls).toHaveAttribute('data-capture-state', 'ready');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export replay JSON' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(download.suggestedFilename()).toMatch(
    /^world-instrument-captured-live-weather-.*\.replay\.json$/,
  );
  expect(JSON.parse(await readFile(downloadPath, 'utf8'))).toMatchObject({
    schemaVersion: 'replay-snapshot.v1',
    score: {
      scoreId: 'weather-score',
      scoreVersion: '1.0.0',
    },
    frames: [
      {
        frameIndex: 0,
        seed: 'world-instrument-live-weather-v1',
      },
    ],
    metadata: {
      fixture: false,
      mode: 'captured',
      frames: [
        {
          provenance: {
            registeredSourceId: 'weather.open-meteo',
            sourceIdentity: 'London, UK weather',
            sourceMode: 'live',
            status: 'ready',
            uiMode: 'live',
          },
        },
      ],
    },
  });

  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(streamControls).toHaveAttribute('data-instrument-mode', 'replay');
  await expect(streamControls).toHaveAttribute('data-provenance-mode', 'replay');
  await expect(streamControls).toHaveAttribute('data-provenance-status', 'ready');
  await expect(provenance.locator('.provenance-summary')).toContainText(
    'Replay archive is driving output from London, UK weather via weather-score 1.0.0.',
  );
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.scoreSignature))
    .toBe('8f5c7a72');
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.weatherCondition))
    .toBe('overcast');
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const serializedParameters = element.dataset.visualParameters;
        const parsedParameters: unknown =
          serializedParameters === undefined ? undefined : JSON.parse(serializedParameters);

        return parsedParameters;
      }),
    )
    .toEqual({
      condition: 'overcast',
      signature: '8f5c7a72',
      bodyColor: '#7fb7ff',
      accentColor: '#d8b4fe',
      rotationSpeedY: 0.388,
      pulseAmplitude: 0.083,
      wireOpacity: 0.372,
      glowOpacity: 0.24,
    });

  await expect(page.getByRole('region', { name: 'Replay controls' })).toBeVisible();
  await expect(page.getByLabel('Archive')).toHaveValue('weather-london-archive');
  await expect(page.getByLabel('Replay time')).toHaveValue('0');

  const audioControls = page.getByRole('region', { name: 'Audio controls' });
  await expect(audioControls).toBeVisible();
  await expect(audioControls).toHaveAttribute('data-audio-state', 'stopped');
  await expect
    .poll(() =>
      audioControls.evaluate((element) => {
        const serializedParameters = element.dataset.audioParameters;
        const parsedParameters: unknown =
          serializedParameters === undefined ? undefined : JSON.parse(serializedParameters);

        return parsedParameters;
      }),
    )
    .toEqual({
      signature: '8f5c7a72',
      enabled: true,
      carrierFrequencyHz: 168.41,
      filterFrequencyHz: 769.84,
      modulationFrequencyHz: 1.013,
      gain: 0.052,
      textureGain: 0.003,
    });

  await page.getByRole('button', { name: 'Step forward' }).click();
  await expect.poll(() => canvas.evaluate((element) => element.dataset.scoreFrameIndex)).toBe('1');
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.weatherCondition))
    .toBe('clear');

  await page.getByRole('button', { name: 'Restart' }).click();
  await expect.poll(() => canvas.evaluate((element) => element.dataset.scoreFrameIndex)).toBe('0');
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.scoreSignature))
    .toBe('8f5c7a72');

  const replayTime = page.getByLabel('Replay time');
  await replayTime.focus();
  await page.keyboard.press('End');
  await expect.poll(() => canvas.evaluate((element) => element.dataset.scoreFrameIndex)).toBe('2');
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.weatherCondition))
    .toBe('rain');

  await page.getByRole('button', { name: 'Start audio' }).click();
  await expect
    .poll(() => audioControls.evaluate((element) => element.getAttribute('data-audio-state')))
    .toBe('running');
  await page.getByRole('button', { name: 'Mute audio' }).click();
  await expect(audioControls).toHaveAttribute('data-audio-muted', 'true');
  await page.getByRole('button', { name: 'Stop audio' }).click();
  await expect(audioControls).toHaveAttribute('data-audio-state', 'stopped');

  const hapticControls = page.getByRole('region', { name: 'Haptic controls' });
  await expect(hapticControls).toBeVisible();
  await expect(hapticControls).toHaveAttribute('data-haptic-state', 'disabled');
  await expect(hapticControls).toHaveAttribute('data-haptic-supported', 'true');
  await expect
    .poll(() =>
      hapticControls.evaluate((element) => {
        const serializedPattern = element.dataset.hapticPattern;
        const parsedPattern: unknown =
          serializedPattern === undefined ? undefined : JSON.parse(serializedPattern);

        return parsedPattern;
      }),
    )
    .toEqual({
      signature: '6247890f',
      enabled: true,
      intensity: 0.281,
      pulseDurationMs: 59,
      repeatCount: 2,
      pattern: [59, 131, 59],
    });
  await page.evaluate(() => {
    (
      window as unknown as { readonly __worldInstrumentVibrations: VibratePattern[] }
    ).__worldInstrumentVibrations.length = 0;
  });
  await page.getByRole('button', { name: 'Enable haptics' }).click();
  await expect(hapticControls).toHaveAttribute('data-haptic-enabled', 'true');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { readonly __worldInstrumentVibrations: readonly VibratePattern[] })
            .__worldInstrumentVibrations,
      ),
    )
    .toEqual([[59, 131, 59]]);

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => element.dataset.scoreFrameIndex)).toBe('0');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
});

test('captures the visible replay fallback when live weather fails before first frame', async ({
  page,
}) => {
  await page.route('https://api.open-meteo.com/v1/forecast**', async (route) => {
    await route.fulfill({
      status: 503,
      json: {},
    });
  });

  await page.goto('/');

  const streamControls = page.getByRole('region', { name: 'Stream controls' });
  const canvas = page.getByTestId('instrument-canvas');
  await expect(streamControls).toHaveAttribute('data-instrument-mode', 'live');
  await expect(streamControls).toHaveAttribute('data-live-state', 'error');
  await expect(streamControls).toHaveAttribute('data-provenance-mode', 'replay-fallback');
  await expect(streamControls).toHaveAttribute('data-provenance-status', 'error');
  const provenance = page.getByRole('region', { name: 'Current data provenance' });
  await expect(provenance.locator('.provenance-summary')).toContainText(
    'Replay fallback is driving output from London weather archive via weather-score 1.0.0; Open-Meteo weather is error.',
  );
  await expect(streamControls.locator('.live-status')).toHaveText(
    'Live weather adapter error: Weather provider request failed with HTTP 503. Showing deterministic replay fallback.',
  );
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.scoreSignature))
    .toBe('8f5c7a72');

  const captureControls = page.getByRole('region', { name: 'Capture controls' });
  await expect(captureControls).toHaveAttribute('data-capture-state', 'idle');
  await page.getByRole('button', { name: 'Start capture' }).click();
  await expect(captureControls).toHaveAttribute('data-capture-state', 'recording');
  await expect(captureControls).toHaveAttribute('data-capture-frame-count', '1');
  await page.getByRole('button', { name: 'Stop capture' }).click();
  await expect(captureControls).toHaveAttribute('data-capture-state', 'ready');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export replay JSON' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(JSON.parse(await readFile(downloadPath, 'utf8'))).toMatchObject({
    schemaVersion: 'replay-snapshot.v1',
    frames: [
      {
        frameIndex: 0,
        elapsedMs: 0,
        seed: 'weather-score-v1:london:0',
      },
    ],
    metadata: {
      capture: {
        frameCount: 1,
        sourceMode: 'replay',
      },
      frames: [
        {
          provenance: {
            registeredSourceId: 'weather.open-meteo',
            sourceMode: 'replay',
            status: 'error',
            uiMode: 'replay-fallback',
          },
        },
      ],
    },
  });
});

test('marks stale and offline provenance without raw feed details', async ({ page }) => {
  await page.route('https://api.open-meteo.com/v1/forecast**', async (route) => {
    const observedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    await route.fulfill({
      json: {
        latitude: 51.5,
        longitude: -0.12,
        timezone: 'GMT',
        current: {
          time: observedAt,
          temperature_2m: 17.2,
          apparent_temperature: 16.9,
          relative_humidity_2m: 76,
          precipitation: 0,
          rain: 0,
          weather_code: 3,
          cloud_cover: 80,
          surface_pressure: 1010.4,
          wind_speed_10m: 5.1,
          wind_direction_10m: 210,
        },
      },
    });
  });

  await page.goto('/');

  const streamControls = page.getByRole('region', { name: 'Stream controls' });
  const provenance = page.getByRole('region', { name: 'Current data provenance' });
  await expect(streamControls).toHaveAttribute('data-live-state', 'stale');
  await expect(streamControls).toHaveAttribute('data-provenance-mode', 'live');
  await expect(streamControls).toHaveAttribute('data-provenance-status', 'stale');
  await expect(provenance.locator('.provenance-summary')).toContainText(
    'Live output from London, UK weather via weather-score 1.0.0; stale.',
  );
  await expect(provenance.locator('.provenance-summary')).toContainText(/Frame \d hr old\./);

  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });
  });
  await page.reload();

  await expect(streamControls).toHaveAttribute('data-live-state', 'offline');
  await expect(streamControls).toHaveAttribute('data-provenance-mode', 'replay-fallback');
  await expect(streamControls).toHaveAttribute('data-provenance-status', 'offline');
  await expect(provenance.locator('.provenance-summary')).toContainText(
    'Replay fallback is driving output from London weather archive via weather-score 1.0.0; Open-Meteo weather is offline.',
  );
});
