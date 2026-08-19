export class PdokUnavailableError extends Error {
  constructor(reason: string, cause?: unknown) {
    super(`PDOK source unavailable: ${reason}`);
    this.name = 'PdokUnavailableError';
    this.cause = cause;
  }
}

export class PdokGeometryError extends Error {
  constructor(reason: string) {
    super(`Invalid or oversized geometry: ${reason}`);
    this.name = 'PdokGeometryError';
  }
}

export class PdokValidationError extends Error {
  constructor(reason: string) {
    super(`PDOK response failed validation: ${reason}`);
    this.name = 'PdokValidationError';
  }
}
