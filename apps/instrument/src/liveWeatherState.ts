import type { NormalizedStreamState } from '@world-instrument/core';

import type {
  LiveWeatherInstrumentFrameState,
  LiveWeatherReadState,
  LiveWeatherReadStatus,
} from './liveWeather.ts';

export type LiveWeatherUiStatus = LiveWeatherReadStatus | 'idle' | 'loading';

export interface LiveWeatherUiState {
  readonly status: LiveWeatherUiStatus;
  readonly message: string;
  readonly frame?: LiveWeatherInstrumentFrameState;
  readonly streamState?: NormalizedStreamState;
}

export function mergeLiveWeatherUiState(
  currentState: LiveWeatherUiState,
  nextState: LiveWeatherReadState,
): LiveWeatherUiState {
  if (nextState.frame !== undefined && nextState.streamState !== undefined) {
    return {
      status: nextState.status,
      message: nextState.message,
      frame: nextState.frame,
      streamState: nextState.streamState,
    };
  }

  const frame = currentState.frame;
  const streamState = frame === undefined ? nextState.streamState : currentState.streamState;

  return {
    status: nextState.status,
    message: nextState.message,
    ...(frame === undefined ? {} : { frame }),
    ...(streamState === undefined ? {} : { streamState }),
  };
}
