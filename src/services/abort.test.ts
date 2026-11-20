import { describe, expect, it } from "vitest";
import {
  assertNotAborted,
  createAbortError,
  isAbortError,
} from "./abort";

describe("abort helpers", () => {
  it("createAbortError 生成 AbortError", () => {
    const error = createAbortError("已停止");

    expect(error).toBeInstanceOf(DOMException);
    expect(error.name).toBe("AbortError");
    expect(error.message).toBe("已停止");
  });

  it("assertNotAborted 在取消后抛出", () => {
    const controller = new AbortController();
    controller.abort();

    expect(() => assertNotAborted(controller.signal)).toThrowError(
      "操作已取消"
    );
    expect(() => assertNotAborted()).not.toThrow();
  });

  it("isAbortError 识别 AbortError", () => {
    expect(isAbortError(createAbortError())).toBe(true);
    expect(isAbortError(new Error("boom"))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError("AbortError")).toBe(false);
  });
});
