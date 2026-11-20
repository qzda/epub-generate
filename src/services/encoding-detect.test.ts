import { describe, expect, it, vi } from "vitest";
import { detectTextEncoding } from "./encoding-detect";

const GBK_SAMPLE = (() => {
  const sequence = Uint8Array.from([
    0xd6, 0xd0, 0xce, 0xc4, 0xb2, 0xe2, 0xca, 0xd4,
  ]);
  const bytes = new Uint8Array(sequence.length * 4);

  for (let index = 0; index < 4; index += 1) {
    bytes.set(sequence, index * sequence.length);
  }

  return bytes;
})();

describe("detectTextEncoding", () => {
  it("识别 UTF-8", async () => {
    const result = await detectTextEncoding(
      new Blob([new TextEncoder().encode("中文测试内容")])
    );

    expect(result).toEqual({
      encoding: "utf-8",
      detected: "UTF-8",
      fallback: false,
    });
  });

  it("识别 GBK/GB18030", async () => {
    const result = await detectTextEncoding(new Blob([GBK_SAMPLE]));

    expect(["gbk", "gb18030"]).toContain(result.encoding);
    expect(result.fallback).toBe(false);
    expect(new TextDecoder(result.encoding).decode(GBK_SAMPLE)).toBe(
      "中文测试中文测试中文测试中文测试"
    );
  });

  it("把 ASCII 视为 UTF-8，不标记回退", async () => {
    const result = await detectTextEncoding(
      new Blob([new TextEncoder().encode("plain ascii")])
    );

    expect(result).toEqual({
      encoding: "utf-8",
      detected: "ASCII",
      fallback: false,
    });
  });

  it("空文件使用 UTF-8 且不标记回退", async () => {
    expect(await detectTextEncoding(new Blob([]))).toEqual({
      encoding: "utf-8",
      detected: null,
      fallback: false,
    });
  });

  it("检测到未知编码时回退 UTF-8 并标记", async () => {
    const result = await detectTextEncoding(new Blob([new Uint8Array([1, 2])]), {
      detector: () => "UTF-32",
    });

    expect(result).toEqual({
      encoding: "utf-8",
      detected: "UTF-32",
      fallback: true,
    });
  });

  it("检测器返回 null 时回退 UTF-8 并标记", async () => {
    const result = await detectTextEncoding(new Blob([new Uint8Array([1])]), {
      detector: () => null,
    });

    expect(result).toEqual({
      encoding: "utf-8",
      detected: null,
      fallback: true,
    });
  });

  it("只把前 sniffSize 字节交给检测器", async () => {
    const detector = vi.fn((_bytes: Uint8Array) => "UTF-8");
    await detectTextEncoding(new Blob([new Uint8Array(100).fill(0x41)]), {
      sniffSize: 10,
      detector,
    });

    expect(detector).toHaveBeenCalledTimes(1);
    expect(detector.mock.calls[0][0]).toHaveLength(10);
  });

  it("开始前已取消则抛出 AbortError", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      detectTextEncoding(new Blob([]), { signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
