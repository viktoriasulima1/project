/**
 * Typed errors for the Ctgb integration. Never construct these with a raw
 * upstream error message baked into `.message` if that message might
 * contain response bodies/headers — keep the safe summary in `.message`
 * and put anything raw in `.cause` (server-log only, never sent to a
 * client — see src/lib/user-error.ts's own convention).
 */

export class CtgbUnavailableError extends Error {
  constructor(reason: string, cause?: unknown) {
    super(`Ctgb source unavailable: ${reason}`);
    this.name = 'CtgbUnavailableError';
    this.cause = cause;
  }
}

export class CtgbNotFoundError extends Error {
  constructor(sourceProductId: string) {
    super(`No Ctgb authorisation found for source product id "${sourceProductId}"`);
    this.name = 'CtgbNotFoundError';
  }
}

export class CtgbValidationError extends Error {
  constructor(reason: string) {
    super(`Ctgb response failed validation: ${reason}`);
    this.name = 'CtgbValidationError';
  }
}

export class CtgbRateLimitError extends Error {
  constructor() {
    super('Ctgb rate limit reached — retry after backoff');
    this.name = 'CtgbRateLimitError';
  }
}
