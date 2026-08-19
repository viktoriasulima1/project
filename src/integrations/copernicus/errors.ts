export class CopernicusUnavailableError extends Error {
  constructor(reason: string, cause?: unknown) {
    super(`Copernicus source unavailable: ${reason}`);
    this.name = 'CopernicusUnavailableError';
    this.cause = cause;
  }
}

export class CopernicusAuthError extends Error {
  constructor(reason: string, cause?: unknown) {
    super(`Copernicus authentication failed: ${reason}`);
    this.name = 'CopernicusAuthError';
    this.cause = cause;
  }
}

export class CopernicusGeometryError extends Error {
  constructor(reason: string) {
    super(`Invalid or missing field geometry: ${reason}`);
    this.name = 'CopernicusGeometryError';
  }
}
