export class UnsupportedPlatformError extends Error {
  feature: string;

  constructor(feature: string) {
    super(`${feature} is only available in the Android app runtime.`);
    this.name = 'UnsupportedPlatformError';
    this.feature = feature;
  }
}

export function isUnsupportedPlatformError(error: unknown): error is UnsupportedPlatformError {
  return error instanceof UnsupportedPlatformError;
}
