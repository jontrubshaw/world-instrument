import type { StreamSourceLocation } from '@world-instrument/core';

export type SourceLocationInputMode = 'browser' | 'custom' | 'default';
export type BrowserLocationStatus =
  | 'denied'
  | 'error'
  | 'idle'
  | 'locating'
  | 'ready'
  | 'unavailable';
export type SourceLocationResolutionStatus = 'invalid' | 'loading' | 'ready' | 'unavailable';

export interface SourceLocationUiState {
  readonly inputMode: SourceLocationInputMode;
  readonly customLatitude: string;
  readonly customLongitude: string;
  readonly customLabel: string;
  readonly browserStatus: BrowserLocationStatus;
  readonly browserMessage: string;
  readonly browserLocation?: StreamSourceLocation;
}

export interface SourceLocationResolution {
  readonly status: SourceLocationResolutionStatus;
  readonly message: string;
  readonly location?: StreamSourceLocation;
}

export function createInitialSourceLocationState(): SourceLocationUiState {
  return {
    inputMode: 'default',
    customLatitude: '',
    customLongitude: '',
    customLabel: '',
    browserStatus: 'idle',
    browserMessage: 'Use browser location to share local coordinates.',
  };
}

export function resolveSourceLocation(
  state: SourceLocationUiState,
  defaultLocation: StreamSourceLocation,
): SourceLocationResolution {
  switch (state.inputMode) {
    case 'default':
      return {
        status: 'ready',
        message: `Using ${defaultLocation.label}.`,
        location: defaultLocation,
      };
    case 'custom':
      return resolveCustomLocation(state);
    case 'browser':
      return resolveBrowserLocation(state);
  }
}

export function sourceLocationKey(location: StreamSourceLocation | undefined): string {
  if (location === undefined) {
    return 'none';
  }

  return [
    location.id,
    location.label,
    String(location.latitude),
    String(location.longitude),
    location.timezone ?? '',
  ].join('|');
}

export function createBrowserSourceLocation(
  coordinates: GeolocationCoordinates,
): StreamSourceLocation {
  const latitude = roundCoordinate(coordinates.latitude);
  const longitude = roundCoordinate(coordinates.longitude);

  return {
    id: `browser-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
    label: `Browser location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
    latitude,
    longitude,
  };
}

function resolveCustomLocation(state: SourceLocationUiState): SourceLocationResolution {
  const latitude = parseCoordinate(state.customLatitude);
  const longitude = parseCoordinate(state.customLongitude);

  if (latitude === undefined || longitude === undefined || latitude < -90 || latitude > 90) {
    return invalidCustomLocation();
  }

  if (longitude < -180 || longitude > 180) {
    return invalidCustomLocation();
  }

  const roundedLatitude = roundCoordinate(latitude);
  const roundedLongitude = roundCoordinate(longitude);
  const label =
    state.customLabel.trim().length > 0
      ? state.customLabel.trim()
      : `Custom ${roundedLatitude.toFixed(4)}, ${roundedLongitude.toFixed(4)}`;

  return {
    status: 'ready',
    message: `Using ${label}.`,
    location: {
      id: `custom-${roundedLatitude.toFixed(4)}-${roundedLongitude.toFixed(4)}`,
      label,
      latitude: roundedLatitude,
      longitude: roundedLongitude,
    },
  };
}

function resolveBrowserLocation(state: SourceLocationUiState): SourceLocationResolution {
  if (state.browserLocation !== undefined && state.browserStatus === 'ready') {
    return {
      status: 'ready',
      message: `Using ${state.browserLocation.label}.`,
      location: state.browserLocation,
    };
  }

  if (state.browserStatus === 'locating') {
    return {
      status: 'loading',
      message: 'Requesting browser location...',
    };
  }

  if (state.browserStatus === 'denied') {
    return {
      status: 'unavailable',
      message:
        'Browser location permission was denied. Choose custom coordinates or the default location.',
    };
  }

  if (state.browserStatus === 'unavailable') {
    return {
      status: 'unavailable',
      message: 'Browser geolocation is unavailable. Choose custom coordinates or the default location.',
    };
  }

  if (state.browserStatus === 'error') {
    return {
      status: 'unavailable',
      message:
        state.browserMessage.length > 0
          ? state.browserMessage
          : 'Browser location could not be read.',
    };
  }

  return {
    status: 'unavailable',
    message: 'Use browser location before starting live weather from this source location.',
  };
}

function invalidCustomLocation(): SourceLocationResolution {
  return {
    status: 'invalid',
    message: 'Enter latitude -90 to 90 and longitude -180 to 180 before using this location.',
  };
}

function parseCoordinate(value: string): number | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }

  const coordinate = Number(value);

  return Number.isFinite(coordinate) ? coordinate : undefined;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
