import { expect, test } from '@playwright/test';

test('loads the instrument shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('World Instrument');
  await expect(
    page.getByRole('heading', { name: 'A weather score tuned into light and tone.' }),
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
  await expect(audioControls.getByText('Audio standing by')).toBeVisible();
  await expect
    .poll(() => audioControls.evaluate((element) => element.dataset.audioStatus))
    .toBe('idle');
  await expect
    .poll(() =>
      audioControls.evaluate((element) => {
        const serializedPlan = element.dataset.audioPlan;
        const parsedPlan: unknown =
          serializedPlan === undefined ? undefined : JSON.parse(serializedPlan);

        return parsedPlan;
      }),
    )
    .toEqual({
      signature: '8f5c7a72',
      frameIndex: 0,
      carrierFrequencyHz: 211.562,
      filterFrequencyHz: 650.68,
      modulationRateHz: 1.966,
      enabled: true,
    });

  await page.getByRole('button', { name: 'Start audio' }).click();
  await expect(audioControls.getByText('Audio running')).toBeVisible();
  await page.getByRole('button', { name: 'Mute' }).click();
  await expect(audioControls.getByText('Audio muted')).toBeVisible();
  await expect
    .poll(() => audioControls.evaluate((element) => element.dataset.audioMuted))
    .toBe('true');
  await page.getByRole('button', { name: 'Unmute' }).click();
  await expect(audioControls.getByText('Audio running')).toBeVisible();

  await page.getByRole('button', { name: 'Step forward' }).click();
  await expect.poll(() => canvas.evaluate((element) => element.dataset.scoreFrameIndex)).toBe('1');
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.weatherCondition))
    .toBe('clear');
  await expect
    .poll(() =>
      audioControls.evaluate((element) => {
        const serializedPlan = element.dataset.audioPlan;
        const parsedPlan: unknown =
          serializedPlan === undefined ? undefined : JSON.parse(serializedPlan);

        return parsedPlan;
      }),
    )
    .toMatchObject({
      frameIndex: 1,
      signature: 'a64de263',
    });

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

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => element.dataset.scoreFrameIndex)).toBe('0');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(audioControls.getByText('Audio stopped')).toBeVisible();
});
