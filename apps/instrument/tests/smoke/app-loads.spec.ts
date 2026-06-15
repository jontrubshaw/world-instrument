import { expect, test } from '@playwright/test';

test('loads the instrument shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('World Instrument');
  await expect(
    page.getByRole('heading', { name: 'A weather score tuned into light.' }),
  ).toBeVisible();

  const canvas = page.getByTestId('instrument-canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => element.clientWidth > 0)).toBe(true);
  await expect.poll(() => canvas.evaluate((element) => element.clientHeight > 0)).toBe(true);
  await expect.poll(() => canvas.evaluate((element) => element.dataset.scoreId)).toBe('weather-score');
  await expect.poll(() => canvas.evaluate((element) => element.dataset.scoreSignature)).toBe('8f5c7a72');
  await expect.poll(() => canvas.evaluate((element) => element.dataset.weatherCondition)).toBe('overcast');
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const serializedParameters = element.dataset.visualParameters;

        return serializedParameters === undefined ? undefined : JSON.parse(serializedParameters);
      }),
    )
    .toEqual({
      condition: 'overcast',
      signature: '8f5c7a72',
      bodyColor: '#7fb7ff',
      accentColor: '#d8b4fe',
      rotationSpeedY: 0.256,
      pulseAmplitude: 0.054,
      wireOpacity: 0.372,
      glowOpacity: 0.24,
    });
});
