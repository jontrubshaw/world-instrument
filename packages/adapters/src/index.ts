export {
  WEATHER_ADAPTER_ID,
  WEATHER_ADAPTER_VERSION,
  WEATHER_CREDENTIAL_ENV,
  WeatherAdapter,
  normalizeWeatherPayload,
  type NormalizeWeatherOptions,
  type RecordedWeatherPayload,
  type WeatherAdapterConfig,
  type WeatherAdapterFailurePayload,
  type WeatherAdapterRaw,
  type WeatherCurrentPayload,
  type WeatherFetch,
  type WeatherFetchResponse,
  type WeatherFixtureAdapterConfig,
  type WeatherLiveAdapterConfig,
  type WeatherLocation,
} from './weather.ts';
export { recordedOpenMeteoLondonCurrentV1 } from './fixtures/open-meteo-london-current-v1.ts';
