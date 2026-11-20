import { strToU8, zipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toBlobPart } from "./binary";
import { readComicSource } from "./comic-source";

function createZip(files: Record<string, Uint8Array | string>): Blob {
  const entries: Record<string, Uint8Array> = {};

  for (const [path, value] of Object.entries(files)) {
    entries[path] = typeof value === "string" ? strToU8(value) : value;
  }

  return new Blob([toBlobPart(zipSync(entries))]);
}

describe("readComicSource", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("按自然序返回图片，并只为前 N 张创建预览", async () => {
    const urls: string[] = [];
    const revoked: string[] = [];
    const blob = createZip({
      "pages/10.jpg": new Uint8Array([10]),
      "pages/2.png": new Uint8Array([2]),
      "pages/1.jpg": new Uint8Array([1]),
      "notes.txt": "ignore",
      "pages/": new Uint8Array(0),
    });

    const result = await readComicSource(blob, {
      previewLimit: 2,
      createObjectUrl: () => {
        const url = `blob:preview-${urls.length + 1}`;
        urls.push(url);
        return url;
      },
      revokeObjectUrl: (url) => revoked.push(url),
    });

    expect(result.images.map((image) => image.path)).toEqual([
      "pages/1.jpg",
      "pages/2.png",
      "pages/10.jpg",
    ]);
    expect(result.images.map((image) => image.mimeType)).toEqual([
      "image/jpeg",
      "image/png",
      "image/jpeg",
    ]);
    expect(result.images[0].data).toEqual(new Uint8Array([1]));
    expect(result.totalImages).toBe(3);
    expect(result.previews).toEqual([
      { path: "pages/1.jpg", url: "blob:preview-1" },
      { path: "pages/2.png", url: "blob:preview-2" },
    ]);

    result.dispose();
    result.dispose();

    expect(revoked).toEqual(["blob:preview-1", "blob:preview-2"]);
  });

  it("拒绝空文件", async () => {
    await expect(readComicSource(new Blob([]))).rejects.toMatchObject({
      code: "EMPTY_ARCHIVE",
    });
  });

  it("拒绝空 ZIP", async () => {
    await expect(readComicSource(createZip({}))).rejects.toMatchObject({
      code: "EMPTY_ARCHIVE",
    });
  });

  it("拒绝非 ZIP 文件", async () => {
    await expect(
      readComicSource(new Blob([new TextEncoder().encode("not a zip")]))
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FILE" });
  });

  it("拒绝不足 4 字节的文件", async () => {
    await expect(
      readComicSource(new Blob([new Uint8Array([0x50, 0x4b])]))
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FILE" });
  });

  it("拒绝损坏的 ZIP", async () => {
    const broken = new Uint8Array(40);
    broken.set([0x50, 0x4b, 0x03, 0x04], 0);

    await expect(readComicSource(new Blob([broken]))).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE",
    });
  });

  it("ZIP 中没有图片时抛出 NO_IMAGES", async () => {
    const blob = createZip({
      "notes.txt": "hello",
      "pages/": new Uint8Array(0),
    });

    await expect(readComicSource(blob)).rejects.toMatchObject({
      code: "NO_IMAGES",
    });
  });

  it("开始前已取消则抛出 AbortError", async () => {
    const controller = new AbortController();
    controller.abort();
    const createObjectUrl = vi.fn();

    await expect(
      readComicSource(createZip({ "1.jpg": new Uint8Array([1]) }), {
        signal: controller.signal,
        createObjectUrl,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("未注入 URL 依赖时使用全局 URL", async () => {
    const createObjectUrl = vi.fn(() => "blob:global");
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl });

    const result = await readComicSource(
      createZip({ "1.jpg": new Uint8Array([1]) })
    );

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(result.previews).toEqual([
      { path: "1.jpg", url: "blob:global" },
    ]);

    result.dispose();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:global");
  });

  it("previewLimit 为 0 时不创建预览", async () => {
    const createObjectUrl = vi.fn();

    const result = await readComicSource(
      createZip({ "1.jpg": new Uint8Array([1]) }),
      { previewLimit: 0, createObjectUrl }
    );

    expect(result.previews).toEqual([]);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
