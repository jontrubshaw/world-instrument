import { expect, test } from '@playwright/test';

test('loads the instrument shell', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'vibrate', {
      configurable: true,
      value: undefined,
    });
  });

  await page.goto('/');

  await expect(page).toHaveTitle('World Instrument');
  await expect(
    page.getByRole('heading', { name: 'A weather score tuned into light.' }),
  ).toBeVisible();

  const canvas = page.getByTestId('instrument-canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => element.clientWidth > 0)).toBe(true);
  await expect.poll(() => canvas.evaluate((element) => element.clientHeight > 0)).toBe(true);
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.scoreId))
    .toBe('weather-score');
  await expect.poll(() => canvas.evaluate((element) => element.dataset.scoreFrameIndex)).toBe('0');
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

  await expect(page.getByRole('region', { name: 'Haptic controls' })).toHaveCount(0);

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

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => element.dataset.scoreFrameIndex)).toBe('0');
  await page.getByRole('button', { name: 'Pause' }).click();
});

test('enables browser vibration controls when haptics are supported', async ({ page }) => {
  await page.addInitScript(() => {
    const vibrationCalls: VibratePattern[] = [];

    Object.defineProperty(window, '__worldInstrumentVibrationCalls', {
      configurable: true,
      value: vibrationCalls,
    });
    Object.defineProperty(Navigator.prototype, 'vibrate', {
      configurable: true,
      value(pattern: VibratePattern) {
        vibrationCalls.push(pattern);

        return true;
      },
    });
  });

  await page.goto('/');

  const hapticControls = page.getByRole('region', { name: 'Haptic controls' });
  await expect(hapticControls).toBeVisible();
  await expect(hapticControls).toHaveAttribute('data-haptic-state', 'disabled');
  await expect(hapticControls).toHaveAttribute('data-haptic-active', 'true');
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
      signature: '8f5c7a72',
      enabled: true,
      intensity: 0.083,
      repetitions: 2,
      pattern: [26, 105, 26],
      totalDurationMs: 157,
    });

  await page.getByRole('button', { name: 'Enable haptics' }).click();
  await expect(hapticControls).toHaveAttribute('data-haptic-state', 'enabled');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              readonly __worldInstrumentVibrationCalls?: readonly VibratePattern[];
            }
          ).__worldInstrumentVibrationCalls ?? [],
      ),
    )
    .toContainEqual([26, 105, 26]);

  await page.getByRole('button', { name: 'Disable haptics' }).click();
  await expect(hapticControls).toHaveAttribute('data-haptic-state', 'disabled');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              readonly __worldInstrumentVibrationCalls?: readonly VibratePattern[];
            }
          ).__worldInstrumentVibrationCalls ?? [],
      ),
    )
    .toContain(0);
});
