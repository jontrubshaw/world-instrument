import type {
  BrowserSensorCapabilities,
  BrowserSensorCapabilityState,
  BrowserSensorMotionPayload,
  BrowserSensorOrientationPayload,
  BrowserSensorPermissionState,
  BrowserSensorPointerPayload,
  RecordedBrowserSensorPayload,
} from '@world-instrument/adapters';

export const BROWSER_SENSOR_POINTER_REFRESH_MS = 120;

export interface BrowserSensorRuntimeState {
  readonly snapshot: RecordedBrowserSensorPayload;
  readonly permissionRequestAvailable: boolean;
  readonly permissionState: BrowserSensorPermissionState;
}

export function createInitialBrowserSensorRuntimeState(
  now = new Date(),
): BrowserSensorRuntimeState {
  const capabilities = detectBrowserSensorCapabilities();

  return {
    snapshot: createBrowserSensorSnapshot({
      observedAt: now.toISOString(),
      capabilities,
    }),
    permissionRequestAvailable:
      capabilities.deviceMotion === 'permission-required' ||
      capabilities.deviceOrientation === 'permission-required',
    permissionState: capabilities.permission,
  };
}

export function createBrowserSensorSnapshot(options: {
  readonly observedAt: string;
  readonly capabilities?: BrowserSensorCapabilities;
  readonly motion?: BrowserSensorMotionPayload;
  readonly orientation?: BrowserSensorOrientationPayload;
  readonly pointer?: BrowserSensorPointerPayload;
  readonly receivedAt?: string;
}): RecordedBrowserSensorPayload {
  return {
    provider: 'browser-sensor',
    observedAt: options.observedAt,
    ...(options.receivedAt === undefined ? {} : { receivedAt: options.receivedAt }),
    device: {
      id: 'local-browser',
      label: 'Local browser',
    },
    capabilities: options.capabilities ?? detectBrowserSensorCapabilities(),
    ...(options.pointer === undefined ? {} : { pointer: options.pointer }),
    ...(options.motion === undefined ? {} : { motion: options.motion }),
    ...(options.orientation === undefined ? {} : { orientation: options.orientation }),
  };
}

export function updateBrowserSensorPointer(
  current: BrowserSensorRuntimeState,
  event: PointerEvent,
  now = new Date(),
): BrowserSensorRuntimeState {
  const width = Math.max(window.innerWidth, 1);
  const height = Math.max(window.innerHeight, 1);
  const maxDimension = Math.max(width, height, 1);
  const pointer: BrowserSensorPointerPayload = {
    position: [
      round(clamp(event.clientX / width, 0, 1)),
      round(clamp(event.clientY / height, 0, 1)),
    ],
    velocity: [
      round(clamp(event.movementX / maxDimension, -1, 1)),
      round(clamp(event.movementY / maxDimension, -1, 1)),
    ],
    pressure: round(clamp(event.pressure, 0, 1)),
    buttons: event.buttons,
    active: event.buttons > 0 || event.pointerType === 'touch' || event.pointerType === 'pen',
  };
  const capabilities = {
    ...current.snapshot.capabilities,
    pointer: 'available' as const,
    fallback: hasDeviceInput(current.snapshot) ? 'none' : 'pointer',
  };

  return {
    ...current,
    snapshot: createBrowserSensorSnapshot({
      observedAt: now.toISOString(),
      capabilities,
      pointer,
      ...(current.snapshot.motion === undefined ? {} : { motion: current.snapshot.motion }),
      ...(current.snapshot.orientation === undefined
        ? {}
        : { orientation: current.snapshot.orientation }),
    }),
  };
}

export function updateBrowserSensorMotion(
  current: BrowserSensorRuntimeState,
  event: DeviceMotionEvent,
  now = new Date(),
): BrowserSensorRuntimeState {
  const motion: BrowserSensorMotionPayload = {
    acceleration: tripleFromDeviceMotionAcceleration(event.acceleration),
    rotationRate: tripleFromDeviceRotationRate(event.rotationRate),
    ...(typeof event.interval === 'number' && Number.isFinite(event.interval)
      ? { intervalMs: round(event.interval) }
      : {}),
  };
  const capabilities = permissionedCapabilities(current.snapshot.capabilities, {
    deviceMotion: hasMotionPayload(motion)
      ? 'available'
      : current.snapshot.capabilities.deviceMotion,
  });

  return {
    ...current,
    permissionState: capabilities.permission,
    snapshot: createBrowserSensorSnapshot({
      observedAt: now.toISOString(),
      capabilities,
      motion,
      ...(current.snapshot.pointer === undefined ? {} : { pointer: current.snapshot.pointer }),
      ...(current.snapshot.orientation === undefined
        ? {}
        : { orientation: current.snapshot.orientation }),
    }),
  };
}

export function updateBrowserSensorOrientation(
  current: BrowserSensorRuntimeState,
  event: DeviceOrientationEvent,
  now = new Date(),
): BrowserSensorRuntimeState {
  const orientation: BrowserSensorOrientationPayload = {
    angles: tripleFromDeviceOrientation(event),
    absolute: event.absolute,
  };
  const capabilities = permissionedCapabilities(current.snapshot.capabilities, {
    deviceOrientation:
      orientation.angles === undefined
        ? current.snapshot.capabilities.deviceOrientation
        : 'available',
  });

  return {
    ...current,
    permissionState: capabilities.permission,
    snapshot: createBrowserSensorSnapshot({
      observedAt: now.toISOString(),
      capabilities,
      orientation,
      ...(current.snapshot.pointer === undefined ? {} : { pointer: current.snapshot.pointer }),
      ...(current.snapshot.motion === undefined ? {} : { motion: current.snapshot.motion }),
    }),
  };
}

export async function requestBrowserSensorPermission(
  current: BrowserSensorRuntimeState,
): Promise<BrowserSensorRuntimeState> {
  const motionPermission = await requestDeviceEventPermission('DeviceMotionEvent');
  const orientationPermission = await requestDeviceEventPermission('DeviceOrientationEvent');
  const permissionState = combinedPermissionState(motionPermission, orientationPermission);
  const capabilities: BrowserSensorCapabilities = {
    ...current.snapshot.capabilities,
    permission: permissionState,
    deviceMotion: capabilityAfterPermission(
      current.snapshot.capabilities.deviceMotion,
      motionPermission,
    ),
    deviceOrientation: capabilityAfterPermission(
      current.snapshot.capabilities.deviceOrientation,
      orientationPermission,
    ),
  };

  return {
    snapshot: createBrowserSensorSnapshot({
      observedAt: new Date().toISOString(),
      capabilities,
      ...(current.snapshot.pointer === undefined ? {} : { pointer: current.snapshot.pointer }),
      ...(current.snapshot.motion === undefined ? {} : { motion: current.snapshot.motion }),
      ...(current.snapshot.orientation === undefined
        ? {}
        : { orientation: current.snapshot.orientation }),
    }),
    permissionRequestAvailable: current.permissionRequestAvailable,
    permissionState,
  };
}

function detectBrowserSensorCapabilities(): BrowserSensorCapabilities {
  const hasWindow = typeof window !== 'undefined';
  const pointer: BrowserSensorCapabilityState =
    hasWindow && 'PointerEvent' in window ? 'available' : 'unavailable';
  const deviceMotion = detectDeviceEventCapability('DeviceMotionEvent');
  const deviceOrientation = detectDeviceEventCapability('DeviceOrientationEvent');

  return {
    pointer,
    deviceMotion,
    deviceOrientation,
    permission:
      deviceMotion === 'permission-required' || deviceOrientation === 'permission-required'
        ? 'not-requested'
        : deviceMotion === 'unavailable' && deviceOrientation === 'unavailable'
          ? 'unsupported'
          : 'granted',
    fallback: pointer === 'available' ? 'pointer' : 'synthetic',
  };
}

function detectDeviceEventCapability(
  eventName: 'DeviceMotionEvent' | 'DeviceOrientationEvent',
): BrowserSensorCapabilityState {
  if (typeof window === 'undefined' || !(eventName in window)) {
    return 'unavailable';
  }

  return hasPermissionRequest(eventName) ? 'permission-required' : 'available';
}

function requestDeviceEventPermission(
  eventName: 'DeviceMotionEvent' | 'DeviceOrientationEvent',
): Promise<BrowserSensorPermissionState> {
  const eventConstructor = eventConstructorWithPermission(eventName);

  if (eventConstructor === undefined) {
    return Promise.resolve(hasEventConstructor(eventName) ? 'granted' : 'unsupported');
  }

  return eventConstructor
    .requestPermission()
    .then((result) => (result === 'granted' || result === 'denied' ? result : 'prompt'))
    .catch(() => 'denied');
}

function eventConstructorWithPermission(eventName: 'DeviceMotionEvent' | 'DeviceOrientationEvent'):
  | {
      requestPermission(): Promise<PermissionState>;
    }
  | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const candidate = window[eventName] as unknown;

  if (
    typeof candidate === 'function' &&
    'requestPermission' in candidate &&
    typeof candidate.requestPermission === 'function'
  ) {
    return candidate as { requestPermission(): Promise<PermissionState> };
  }

  return undefined;
}

function hasPermissionRequest(eventName: 'DeviceMotionEvent' | 'DeviceOrientationEvent'): boolean {
  return eventConstructorWithPermission(eventName) !== undefined;
}

function hasEventConstructor(eventName: 'DeviceMotionEvent' | 'DeviceOrientationEvent'): boolean {
  return typeof window !== 'undefined' && eventName in window;
}

function permissionedCapabilities(
  current: BrowserSensorCapabilities,
  updates: Partial<Pick<BrowserSensorCapabilities, 'deviceMotion' | 'deviceOrientation'>>,
): BrowserSensorCapabilities {
  return {
    ...current,
    ...updates,
    permission: 'granted',
    fallback:
      updates.deviceMotion === 'available' ||
      updates.deviceOrientation === 'available' ||
      current.deviceMotion === 'available' ||
      current.deviceOrientation === 'available'
        ? 'none'
        : current.fallback,
  };
}

function capabilityAfterPermission(
  current: BrowserSensorCapabilityState,
  permission: BrowserSensorPermissionState,
): BrowserSensorCapabilityState {
  if (permission === 'granted') {
    return 'available';
  }

  if (permission === 'denied') {
    return 'denied';
  }

  return current;
}

function combinedPermissionState(
  motion: BrowserSensorPermissionState,
  orientation: BrowserSensorPermissionState,
): BrowserSensorPermissionState {
  if (motion === 'granted' || orientation === 'granted') {
    return 'granted';
  }

  if (motion === 'denied' || orientation === 'denied') {
    return 'denied';
  }

  if (motion === 'unsupported' && orientation === 'unsupported') {
    return 'unsupported';
  }

  return 'prompt';
}

function tripleFromDeviceMotionAcceleration(
  value: DeviceMotionEventAcceleration | null,
): readonly [number, number, number] | undefined {
  if (value === null) {
    return undefined;
  }

  return tripleFromValues(value.x, value.y, value.z);
}

function tripleFromDeviceRotationRate(
  value: DeviceMotionEventRotationRate | null,
): readonly [number, number, number] | undefined {
  if (value === null) {
    return undefined;
  }

  return tripleFromValues(value.alpha, value.beta, value.gamma);
}

function tripleFromDeviceOrientation(
  value: DeviceOrientationEvent,
): readonly [number, number, number] | undefined {
  return tripleFromValues(value.alpha, value.beta, value.gamma);
}

function tripleFromValues(
  x: number | null | undefined,
  y: number | null | undefined,
  z: number | null | undefined,
): readonly [number, number, number] | undefined {
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) {
    return undefined;
  }

  return [round(x), round(y), round(z)];
}

function hasMotionPayload(motion: BrowserSensorMotionPayload): boolean {
  return motion.acceleration !== undefined || motion.rotationRate !== undefined;
}

function hasDeviceInput(snapshot: RecordedBrowserSensorPayload): boolean {
  return snapshot.motion !== undefined || snapshot.orientation !== undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
