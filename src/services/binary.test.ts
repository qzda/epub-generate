import { describe, expect, it } from "vitest";
import { toBlobPart } from "./binary";

describe("toBlobPart", () => {
  it("ArrayBuffer 视图保持偏移并零拷贝转换", () => {
    const buffer = new Uint8Array([1, 2, 3, 4, 5]);
    const view = buffer.subarray(1, 4);
    const part = toBlobPart(view) as Uint8Array;

    expect(part.buffer).toBe(buffer.buffer);
    expect(part.byteOffset).toBe(1);
    expect(part.byteLength).toBe(3);
    expect(Array.from(part)).toEqual([2, 3, 4]);
  });

  it("SharedArrayBuffer 视图复制为普通 ArrayBuffer", () => {
    const shared = new SharedArrayBuffer(3);
    const view = new Uint8Array(shared);
    view.set([7, 8, 9]);

    const part = toBlobPart(view) as Uint8Array;

    expect(part.buffer).toBeInstanceOf(ArrayBuffer);
    expect(part.buffer).not.toBe(shared);
    expect(Array.from(part)).toEqual([7, 8, 9]);
  });
});
