export function createAbortError(message = "操作已取消"): DOMException {
  return new DOMException(message, "AbortError");
}

export function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}
