export type ErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'validation_failed'
  | 'duplicate'
  | 'conflict'
  | 'rate_limited'
  | 'internal';

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const Unauthenticated = (msg = 'unauthenticated') =>
  new ApiError('unauthenticated', msg, 401);
export const Forbidden = (msg = 'forbidden') => new ApiError('forbidden', msg, 403);
export const NotFound = (msg = 'not found') => new ApiError('not_found', msg, 404);
export const Validation = (msg: string, details?: unknown) =>
  new ApiError('validation_failed', msg, 422, details);
export const Duplicate = (msg = 'duplicate') => new ApiError('duplicate', msg, 409);
export const RateLimited = (msg = 'rate limited') => new ApiError('rate_limited', msg, 429);
export const Internal = (msg = 'internal error') => new ApiError('internal', msg, 500);
