import { describe, expect, it } from 'vitest';

import {
  createBrowserSourceLocation,
  createInitialSourceLocationState,
  resolveSourceLocation,
  sourceLocationKey,
} from '../src/sourceLocation.ts';

const defaultLocation = {
  id: 'london-uk',
  label: 'London, UK',
  latitude: 51.5072,
  longitude: -0.1276,
};

describe('source location configuration', () => {
  it('resolves the default source location without custom input', () => {
    const resolution = resolveSourceLocation(createInitialSourceLocationState(), defaultLocation);

    expect(resolution).toEqual({
      status: 'ready',
      message: 'Using London, UK.',
      location: defaultLocation,
    });
    expect(sourceLocationKey(resolution.location)).toBe('london-uk|London, UK|51.5072|-0.1276|');
  });

  it('validates custom coordinates before exposing a source location', () => {
    expect(
      resolveSourceLocation(
        {
          ...createInitialSourceLocationState(),
          inputMode: 'custom',
          customLatitude: '95',
          customLongitude: '-3.18',
        },
        defaultLocation,
      ),
    ).toEqual({
      status: 'invalid',
      message: 'Enter latitude -90 to 90 and longitude -180 to 180 before using this location.',
    });

    expect(
      resolveSourceLocation(
        {
          ...createInitialSourceLocationState(),
          inputMode: 'custom',
          customLatitude: '55.9533',
          customLongitude: '-3.1883',
          customLabel: 'Edinburgh, UK',
        },
        defaultLocation,
      ),
    ).toEqual({
      status: 'ready',
      message: 'Using Edinburgh, UK.',
      location: {
        id: 'custom-55.9533--3.1883',
        label: 'Edinburgh, UK',
        latitude: 55.9533,
        longitude: -3.1883,
      },
    });
  });

  it('keeps browser geolocation states explicit until coordinates are available', () => {
    const idleBrowser = resolveSourceLocation(
      {
        ...createInitialSourceLocationState(),
        inputMode: 'browser',
      },
      defaultLocation,
    );

    expect(idleBrowser.status).toBe('unavailable');
    expect(idleBrowser.location).toBeUndefined();

    const browserLocation = createBrowserSourceLocation({
      latitude: 40.712776,
      longitude: -74.005974,
      accuracy: 42,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    } as GeolocationCoordinates);

    expect(
      resolveSourceLocation(
        {
          ...createInitialSourceLocationState(),
          inputMode: 'browser',
          browserStatus: 'ready',
          browserLocation,
        },
        defaultLocation,
      ),
    ).toEqual({
      status: 'ready',
      message: 'Using Browser location (40.7128, -74.0060).',
      location: {
        id: 'browser-40.7128--74.0060',
        label: 'Browser location (40.7128, -74.0060)',
        latitude: 40.7128,
        longitude: -74.006,
      },
    });
  });
});
