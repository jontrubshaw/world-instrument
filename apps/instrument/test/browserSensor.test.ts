import { afterEach, describe, expect, it } from 'vitest';

import {
  createInitialBrowserSensorRuntimeState,
  requestBrowserSensorPermission,
  updateBrowserSensorMotion,
  updateBrowserSensorPointer,
} from '../src/browserSensor.ts';

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

describe('browser sensor runtime', () => {
  afterEach(() => {
    if (originalWindowDescriptor === undefined) {
      Reflect.deleteProperty(globalThis, 'window');

      return;
    }

    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  });

  it('marks lifted touch and pen pointers inactive', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        innerHeight: 500,
        innerWidth: 1_000,
        PointerEvent: function PointerEvent() {},
      },
    });
    const initialState = createInitialBrowserSensorRuntimeState(
      new Date('2026-06-15T12:00:00.000Z'),
    );

    const activeTouch = updateBrowserSensorPointer(
      initialState,
      createPointerEvent({ buttons: 1, pointerType: 'touch' }),
      new Date('2026-06-15T12:00:01.000Z'),
    );
    const liftedTouch = updateBrowserSensorPointer(
      activeTouch,
      createPointerEvent({ buttons: 0, pointerType: 'touch' }),
      new Date('2026-06-15T12:00:02.000Z'),
    );
    const liftedPen = updateBrowserSensorPointer(
      liftedTouch,
      createPointerEvent({ buttons: 0, pointerType: 'pen' }),
      new Date('2026-06-15T12:00:03.000Z'),
    );

    expect(activeTouch.snapshot.pointer?.active).toBe(true);
    expect(liftedTouch.snapshot.pointer?.active).toBe(false);
    expect(liftedPen.snapshot.pointer?.active).toBe(false);
  });

  it('drops stale motion samples when pointer input refreshes later snapshots', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        innerHeight: 500,
        innerWidth: 1_000,
        DeviceMotionEvent: function DeviceMotionEvent() {},
        PointerEvent: function PointerEvent() {},
      },
    });
    const initialState = createInitialBrowserSensorRuntimeState(
      new Date('2026-06-15T12:00:00.000Z'),
    );
    const motionState = updateBrowserSensorMotion(
      initialState,
      createDeviceMotionEvent({
        acceleration: [7.2, 0.4, 0.1],
        rotationRate: [120, 0, 0],
      }),
      new Date('2026-06-15T12:00:01.000Z'),
    );
    const freshPointerState = updateBrowserSensorPointer(
      motionState,
      createPointerEvent({ buttons: 0, pointerType: 'mouse' }),
      new Date('2026-06-15T12:00:03.000Z'),
    );
    const stalePointerState = updateBrowserSensorPointer(
      freshPointerState,
      createPointerEvent({ buttons: 0, pointerType: 'mouse' }),
      new Date('2026-06-15T12:00:05.000Z'),
    );

    expect(motionState.snapshot.motion).toMatchObject({
      acceleration: [7.2, 0.4, 0.1],
      rotationRate: [120, 0, 0],
    });
    expect(freshPointerState.snapshot.motion).toEqual(motionState.snapshot.motion);
    expect(stalePointerState.snapshot.motion).toBeUndefined();
    expect(stalePointerState.snapshot.pointer).toBeDefined();
    expect(stalePointerState.snapshot.capabilities.fallback).toBe('pointer');
  });

  it('starts motion and orientation permission prompts before awaiting either result', async () => {
    const calls: string[] = [];
    const motion = deferred<PermissionState>();
    const orientation = deferred<PermissionState>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        DeviceMotionEvent: function DeviceMotionEvent() {},
        DeviceOrientationEvent: function DeviceOrientationEvent() {},
        PointerEvent: function PointerEvent() {},
      },
    });
    Object.assign(window.DeviceMotionEvent, {
      requestPermission: () => {
        calls.push('motion');

        return motion.promise;
      },
    });
    Object.assign(window.DeviceOrientationEvent, {
      requestPermission: () => {
        calls.push('orientation');

        return orientation.promise;
      },
    });
    const initialState = createInitialBrowserSensorRuntimeState(
      new Date('2026-06-15T12:00:00.000Z'),
    );

    const permissionRequest = requestBrowserSensorPermission(initialState);

    expect(calls).toEqual(['motion', 'orientation']);

    motion.resolve('granted');
    orientation.resolve('granted');

    await expect(permissionRequest).resolves.toMatchObject({
      permissionState: 'granted',
    });
  });
});

function createPointerEvent(options: {
  readonly buttons: number;
  readonly pointerType: string;
}): PointerEvent {
  return {
    buttons: options.buttons,
    clientX: 500,
    clientY: 250,
    movementX: 0,
    movementY: 0,
    pointerType: options.pointerType,
    pressure: options.buttons > 0 ? 0.7 : 0,
  } as PointerEvent;
}

function createDeviceMotionEvent(options: {
  readonly acceleration: readonly [number, number, number];
  readonly rotationRate: readonly [number, number, number];
}): DeviceMotionEvent {
  return {
    acceleration: {
      x: options.acceleration[0],
      y: options.acceleration[1],
      z: options.acceleration[2],
    },
    rotationRate: {
      alpha: options.rotationRate[0],
      beta: options.rotationRate[1],
      gamma: options.rotationRate[2],
    },
    interval: 16.7,
  } as DeviceMotionEvent;
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}
