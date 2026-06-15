import { expect, test } from '@playwright/test';

test('loads the instrument shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('World Instrument');
  await expect(page.getByRole('heading', { name: 'Weather is tuning the surface.' })).toBeVisible();
  await expect(page.getByText('A recorded London weather stream')).toBeVisible();

  const canvas = page.getByTestId('instrument-canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => element.clientWidth > 0)).toBe(true);
  await expect.poll(() => canvas.evaluate((element) => element.clientHeight > 0)).toBe(true);

  const stage = page.getByTestId('instrument-stage');
  await expect(stage).toHaveAttribute('data-weather-condition', 'overcast');
  await expect(stage).toHaveAttribute('data-score-input-hash', '8f5c7a72');
  await expect(stage).toHaveAttribute('data-scene-body-color', '#7fb7ff');
  await expect(stage).toHaveAttribute('data-scene-pulse-rate', '1.619');
});
