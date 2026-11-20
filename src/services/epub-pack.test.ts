import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { EpubEntry } from "../domain/epub/types";
import { DomainError } from "../domain/result";
import { EPUB_BLOB_TYPE, packEpub } from "./epub-pack";

const ENTRIES: EpubEntry[] = [
  {
    path: "mimetype",
    data: "application/epub+zip",
    compression: "STORE",
  },
  {
    path: "META-INF/container.xml",
    data: "<container/>",
  },
  {
    path: "OEBPS/content.opf",
    data: "<package/>",
  },
  {
    path: "OEBPS/images/page.png",
    data: new Uint8Array([1, 2, 3, 4]),
  },
];

function decode(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

describe("packEpub", () => {
  it("生成可解包的 EPUB Blob", async () => {
    const blob = await packEpub(ENTRIES);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const files = unzipSync(bytes);

    expect(blob.type).toBe(EPUB_BLOB_TYPE);
    expect(Object.keys(files)).toEqual(ENTRIES.map((entry) => entry.path));
    expect(decode(files.mimetype)).toBe("application/epub+zip");
    expect(decode(files["META-INF/container.xml"])).toBe("<container/>");
    expect(files["OEBPS/images/page.png"]).toEqual(
      new Uint8Array([1, 2, 3, 4])
    );
  });

  it("mimetype 是第一个文件，未压缩且无 extra field", async () => {
    const blob = await packEpub(ENTRIES);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(6, true)).toBe(0);
    expect(view.getUint16(8, true)).toBe(0);
    expect(view.getUint16(28, true)).toBe(0);

    const nameLength = view.getUint16(26, true);
    const name = decode(bytes.slice(30, 30 + nameLength));
    const content = decode(bytes.slice(30 + nameLength, 30 + nameLength + 20));

    expect(name).toBe("mimetype");
    expect(content).toBe("application/epub+zip");
    expect(view.getUint32(18, true)).toBe(20);
    expect(view.getUint32(22, true)).toBe(20);
  });

  it("相同输入生成相同字节", async () => {
    const first = new Uint8Array(await (await packEpub(ENTRIES)).arrayBuffer());
    const second = new Uint8Array(await (await packEpub(ENTRIES)).arrayBuffer());

    expect(second).toEqual(first);
  });

  it("进度从 0 单调递增到 1", async () => {
    const values: number[] = [];

    await packEpub(ENTRIES, { onProgress: (ratio) => values.push(ratio) });

    expect(values[0]).toBe(0);
    expect(values.at(-1)).toBe(1);
    expect(values.length).toBeGreaterThanOrEqual(3);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("空条目列表抛出 PACK_FAILED", async () => {
    await expect(packEpub([])).rejects.toMatchObject({ code: "PACK_FAILED" });
  });

  it("mimetype 不在第一位时抛出 PACK_FAILED", async () => {
    await expect(
      packEpub([
        { path: "OEBPS/content.opf", data: "<package/>" },
        { path: "mimetype", data: "application/epub+zip" },
      ])
    ).rejects.toMatchObject({ code: "PACK_FAILED" });
  });

  it("开始前已取消则抛出 AbortError", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      packEpub(ENTRIES, { signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("准备阶段取消也会停止打包", async () => {
    const controller = new AbortController();

    await expect(
      packEpub(ENTRIES, {
        signal: controller.signal,
        onProgress: (ratio) => {
          if (ratio === 0) {
            controller.abort();
          }
        },
      })
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("fflate 报错时转换为 PACK_FAILED", async () => {
    const longPath = `${"a".repeat(70_000)}.txt`;

    await expect(
      packEpub([
        { path: "mimetype", data: "application/epub+zip", compression: "STORE" },
        { path: longPath, data: "x" },
      ])
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      packEpub([
        { path: "mimetype", data: "application/epub+zip", compression: "STORE" },
        { path: longPath, data: "x" },
      ])
    ).rejects.toMatchObject({ code: "PACK_FAILED" });
  });
});
