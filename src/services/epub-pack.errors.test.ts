import { describe, expect, it, vi } from "vitest";
import type { EpubEntry } from "../domain/epub/types";
import { packEpub } from "./epub-pack";

type ZipCallback = (
  error: Error | null,
  data: Uint8Array,
  final: boolean
) => void;

const state = vi.hoisted(() => ({
  behavior: (_callback: ZipCallback) => {},
}));

vi.mock("fflate", () => ({
  strToU8: (value: string) => new TextEncoder().encode(value),
  zip: (
    _data: unknown,
    _options: unknown,
    callback: ZipCallback
  ) => {
    state.behavior(callback);
    return () => {};
  },
}));

const ENTRIES: EpubEntry[] = [
  {
    path: "mimetype",
    data: "application/epub+zip",
    compression: "STORE",
  },
  { path: "OEBPS/content.opf", data: "<package/>" },
];

describe("packEpub 取消与打包异常", () => {
  it("压缩过程中取消会立即拒绝", async () => {
    state.behavior = () => {};
    const controller = new AbortController();
    const promise = packEpub(ENTRIES, { signal: controller.signal });

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("取消后 fflate 才回调也不会再次 resolve", async () => {
    let callback: ZipCallback | null = null;
    state.behavior = (value) => {
      callback = value;
    };
    const controller = new AbortController();
    const promise = packEpub(ENTRIES, { signal: controller.signal });

    controller.abort();
    callback!(null, new Uint8Array([1]), true);

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("fflate 同步抛错时转换为 PACK_FAILED", async () => {
    state.behavior = () => {
      throw new Error("boom");
    };

    await expect(packEpub(ENTRIES)).rejects.toMatchObject({
      code: "PACK_FAILED",
    });
  });
});
