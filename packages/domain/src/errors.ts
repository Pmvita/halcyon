export class HalcyonError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "HalcyonError";
    this.code = code;
  }
}

export function isHalcyonError(error: unknown): error is HalcyonError {
  return error instanceof HalcyonError;
}
