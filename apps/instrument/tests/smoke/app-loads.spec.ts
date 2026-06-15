import { expect, test } from '@playwright/test';

test('loads the instrument shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('World Instrument');
  await expect(
    page.getByRole('heading', { name: 'A weather score tuned into light.' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Replay controls' })).toBeVisible();
  await expect(page.getByLabel('Archive')).toHaveValue('open-meteo-london-score-v1');
  await expect(page.getByText('Frame 1 of 4')).toBeVisible();

  const canvas = page.getByTestId('instrument-canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => element.clientWidth > 0)).toBe(true);
  await expect.poll(() => canvas.evaluate((element) => element.clientHeight > 0)).toBe(true);
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.scoreId))
    .toBe('weather-score');
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
});

test('replay controls step, play, restart, and scrub deterministically', async ({ page }) => {
  await page.goto('/');

  const canvas = page.getByTestId('instrument-canvas');
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.scoreSignature))
    .toBe('8f5c7a72');
  const initialSignature = await canvas.evaluate((element) => element.dataset.scoreSignature);

  await page.getByRole('button', { name: 'Step to next replay frame' }).click();
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.weatherCondition))
    .toBe('rain');
  await expect(page.getByText('Frame 2 of 4')).toBeVisible();
  const secondSignature = await canvas.evaluate((element) => element.dataset.scoreSignature);
  expect(secondSignature).toBeTruthy();
  expect(secondSignature).not.toBe(initialSignature);

  await page.getByRole('button', { name: 'Restart' }).click();
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.scoreSignature))
    .toBe(initialSignature);
  await page.getByRole('button', { name: 'Step to next replay frame' }).click();
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.scoreSignature))
    .toBe(secondSignature);

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.weatherCondition))
    .toBe('storm');
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  await page.getByLabel('Replay time').press('End');
  await expect
    .poll(() => canvas.evaluate((element) => element.dataset.weatherCondition))
    .toBe('clear');
  await expect(page.getByText('Frame 4 of 4')).toBeVisible();
});
