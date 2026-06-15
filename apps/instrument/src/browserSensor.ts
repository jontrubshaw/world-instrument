import {
  type BrowserMotionReading,
  type BrowserOrientationReading,
  type BrowserPointerReading,
  type BrowserSensorCapabilityState,
  type BrowserSensorPermissionState,
  type BrowserSensorRead,
  type BrowserSensorSession,
  type RecordedBrowserSensorPayload,
} from '@world-instrument/adapters';

export const LIVE_BROWSER_SENSOR_REFRESH_INTERVAL_MS = 500;
export const LIVE_BROWSER_SENSOR_STALE_AFTER_MS = 8_000;
export const LIVE_BROWSER_SENSOR_SEED = 'world-instrument-live-browser-sensor-v1';
export const FIXTURE_BROWSER_SENSOR_SEED = 'world-instrument-fixture-browser-sensor-v1';

export interface BrowserSensorRuntimeOptions {
  readonly session?: BrowserSensorSession;
  readonly targetWindow?: Window;
}

interface SensorRuntimeState {
  pointer?: BrowserPointerReading;
  motion?: BrowserMotionReading;
  orientation?: BrowserOrientationReading;
  lastObservedAt?: string;
  eventCount: number;
}

interface PermissionRequestEvent {
  readonly requestPermission: () => Promise<unknown>;
}

type SensorWindow = Window & {
  readonly DeviceMotionEvent?: unknown;
  readonly DeviceOrientationEvent?: unknown;
};

const DEFAULT_BROWSER_SENSOR_SESSION: BrowserSensorSession = {
  id: 'local-browser',
  label: 'Local browser',
};

class BrowserSensorRuntime {
  readonly #session: BrowserSensorSession;
  readonly #targetWindow: Window | undefined;
  readonly #state: SensorRuntimeState = {
    eventCount: 0,
  };

  #listening = false;
  #motionPermission: BrowserSensorPermissionState = 'unknown';
  #orientationPermission: BrowserSensorPermissionState = 'unknown';

  constructor(options: BrowserSensorRuntimeOptions = {}) {
    this.#session = options.session ?? DEFAULT_BROWSER_SENSOR_SESSION;
    this.#targetWindow = options.targetWindow ?? browserWindow();
  }

  read(now = new Date()): RecordedBrowserSensorPayload {
    this.#ensureListening();

    const observedAt = this.#state.lastObservedAt ?? now.toISOString();
    const capability = this.#capability();

    return {
      provider: 'browser-sensor',
      observedAt,
      receivedAt: now.toISOString(),
      session: this.#session,
      capability,
      reading: {
        pointer: this.#state.pointer ?? this.#idlePointer(),
        ...(this.#state.motion === undefined ? {} : { motion: this.#state.motion }),
        ...(this.#state.orientation === undefined ? {} : { orientation: this.#state.orientation }),
      },
      eventCount: this.#state.eventCount,
    };
  }

  async requestPermission(): Promise<BrowserSensorCapabilityState> {
    this.#ensureListening();

    const targetWindow = this.#targetWindow;

    if (targetWindow === undefined) {
      this.#motionPermission = 'unsupported';
      this.#orientationPermission = 'unsupported';

      return this.#capability();
    }

    this.#motionPermission = await requestEventPermission(deviceMotionEvent(targetWindow));
    this.#orientationPermission = await requestEventPermission(
      deviceOrientationEvent(targetWindow),
    );

    return this.#capability();
  }

  #ensureListening(): void {
    if (this.#listening) {
      return;
    }

    const targetWindow = this.#targetWindow;
    if (targetWindow === undefined) {
      this.#motionPermission = 'unsupported';
      this.#orientationPermission = 'unsupported';
      return;
    }

    this.#motionPermission = eventPermissionState(deviceMotionEvent(targetWindow));
    this.#orientationPermission = eventPermissionState(deviceOrientationEvent(targetWindow));
    targetWindow.addEventListener('pointermove', this.#handlePointerMove, { passive: true });
    targetWindow.addEventListener('pointerdown', this.#handlePointerMove, { passive: true });
    targetWindow.addEventListener('pointerup', this.#handlePointerMove, { passive: true });
    targetWindow.addEventListener('devicemotion', this.#handleMotion, { passive: true });
    targetWindow.addEventListener('deviceorientation', this.#handleOrientation, { passive: true });
    this.#listening = true;
  }

  readonly #handlePointerMove = (event: PointerEvent): void => {
    const width = Math.max(this.#targetWindow?.innerWidth ?? 1, 1);
    const height = Math.max(this.#targetWindow?.innerHeight ?? 1, 1);
    const previous = this.#state.pointer;
    const x = clamp(event.clientX / width, 0, 1);
    const y = clamp(event.clientY / height, 0, 1);
    const pointer: BrowserPointerReading = {
      x,
      y,
      deltaX: previous === undefined ? 0 : clamp(x - previous.x, -1, 1),
      deltaY: previous === undefined ? 0 : clamp(y - previous.y, -1, 1),
      pressure: clamp(event.pressure, 0, 1),
      buttons: event.buttons,
      active: event.buttons > 0 || event.type !== 'pointerup',
      viewportWidth: width,
      viewportHeight: height,
    };

    this.#state.pointer = pointer;
    this.#markObserved();
  };

  readonly #handleMotion = (event: DeviceMotionEvent): void => {
    this.#motionPermission = 'granted';
    const intervalMs = finiteOrUndefined(event.interval);

    this.#state.motion = {
      acceleration: [
        finiteOrZero(event.accelerationIncludingGravity?.x),
        finiteOrZero(event.accelerationIncludingGravity?.y),
        finiteOrZero(event.accelerationIncludingGravity?.z),
      ],
      rotationRate: [
        finiteOrZero(event.rotationRate?.alpha),
        finiteOrZero(event.rotationRate?.beta),
        finiteOrZero(event.rotationRate?.gamma),
      ],
      ...(intervalMs === undefined ? {} : { intervalMs }),
    };
    this.#markObserved();
  };

  readonly #handleOrientation = (event: DeviceOrientationEvent): void => {
    this.#orientationPermission = 'granted';
    this.#state.orientation = {
      alpha: finiteOrZero(event.alpha),
      beta: finiteOrZero(event.beta),
      gamma: finiteOrZero(event.gamma),
      absolute: event.absolute,
    };
    this.#markObserved();
  };

  #markObserved(): void {
    this.#state.lastObservedAt = new Date().toISOString();
    this.#state.eventCount += 1;
  }

  #idlePointer(): BrowserPointerReading {
    return {
      x: 0.5,
      y: 0.5,
      deltaX: 0,
      deltaY: 0,
      active: false,
    };
  }

  #capability(): BrowserSensorCapabilityState {
    const pointer = this.#targetWindow === undefined ? 'unavailable' : 'available';
    const hasDeviceReading =
      this.#state.motion !== undefined || this.#state.orientation !== undefined;

    return {
      pointer,
      motion: this.#motionPermission,
      orientation: this.#orientationPermission,
      fallback: hasDeviceReading ? 'none' : this.#state.eventCount === 0 ? 'idle' : 'pointer',
    };
  }
}

let sharedRuntime: BrowserSensorRuntime | undefined;

export function readBrowserSensorPayload(now = new Date()): RecordedBrowserSensorPayload {
  return sharedBrowserSensorRuntime().read(now);
}

export const readBrowserSensor: BrowserSensorRead = () => readBrowserSensorPayload();

export async function requestBrowserSensorPermission(): Promise<BrowserSensorCapabilityState> {
  return sharedBrowserSensorRuntime().requestPermission();
}

export function createBrowserSensorRuntime(
  options: BrowserSensorRuntimeOptions = {},
): BrowserSensorRuntime {
  return new BrowserSensorRuntime(options);
}

function sharedBrowserSensorRuntime(): BrowserSensorRuntime {
  sharedRuntime ??= new BrowserSensorRuntime();

  return sharedRuntime;
}

function browserWindow(): Window | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window;
}

function deviceMotionEvent(targetWindow: Window): unknown {
  return (targetWindow as SensorWindow).DeviceMotionEvent;
}

function deviceOrientationEvent(targetWindow: Window): unknown {
  return (targetWindow as SensorWindow).DeviceOrientationEvent;
}

function eventPermissionState(eventConstructor: unknown): BrowserSensorPermissionState {
  if (eventConstructor === undefined) {
    return 'unsupported';
  }

  return hasPermissionRequest(eventConstructor) ? 'prompt' : 'granted';
}

async function requestEventPermission(
  eventConstructor: unknown,
): Promise<BrowserSensorPermissionState> {
  if (eventConstructor === undefined) {
    return 'unsupported';
  }

  if (!hasPermissionRequest(eventConstructor)) {
    return 'granted';
  }

  try {
    const state = await eventConstructor.requestPermission();

    return state === 'granted' || state === 'denied' ? state : 'prompt';
  } catch {
    return 'denied';
  }
}

function hasPermissionRequest(value: unknown): value is PermissionRequestEvent {
  return (
    typeof value === 'function' &&
    'requestPermission' in value &&
    typeof value.requestPermission === 'function'
  );
}

function finiteOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function finiteOrUndefined(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
