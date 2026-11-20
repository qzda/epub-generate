export type AppErrorCode =
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE"
  | "INVALID_ENCODING"
  | "INVALID_PATTERN"
  | "EMPTY_ARCHIVE"
  | "NO_IMAGES"
  | "NO_CHAPTERS"
  | "PACK_FAILED";

export interface AppError {
  code: AppErrorCode;
  message: string;
}

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function fail<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function appError(code: AppErrorCode, message: string): AppError {
  return { code, message };
}

export class DomainError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DomainError";
    this.code = code;
  }
}
