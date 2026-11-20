import { describe, expect, it } from "vitest";
import { DomainError, appError, fail, ok } from "./result";

describe("Result helpers", () => {
  it("ok 包装成功值", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it("fail 包装错误", () => {
    expect(fail({ code: "PACK_FAILED", message: "失败" })).toEqual({
      ok: false,
      error: { code: "PACK_FAILED", message: "失败" },
    });
  });

  it("appError 生成带错误码的对象", () => {
    expect(appError("EMPTY_ARCHIVE", "压缩包为空")).toEqual({
      code: "EMPTY_ARCHIVE",
      message: "压缩包为空",
    });
  });
});

describe("DomainError", () => {
  it("保留错误码与消息", () => {
    const error = new DomainError("NO_IMAGES", "没有图片");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DomainError");
    expect(error.code).toBe("NO_IMAGES");
    expect(error.message).toBe("没有图片");
  });

  it("支持 cause", () => {
    const cause = new Error("底层错误");
    const error = new DomainError("PACK_FAILED", "打包失败", { cause });

    expect(error.cause).toBe(cause);
  });
});
