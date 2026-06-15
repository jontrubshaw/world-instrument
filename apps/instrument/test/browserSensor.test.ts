import { afterEach, describe, expect, it } from 'vitest';

import {
  createInitialBrowserSensorRuntimeState,
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
