import { describe, expect, it } from "vitest";
import type { TextEncoding } from "../domain/encoding";
import { DomainError } from "../domain/result";
import { readFileLines } from "./line-reader";

async function collect(
  blob: Blob,
  encoding: TextEncoding = "utf-8",
  options: { chunkSize?: number; signal?: AbortSignal } = {}
): Promise<string[]> {
  const lines: string[] = [];

  for await (const line of readFileLines(blob, encoding, options)) {
    lines.push(line);
  }

  return lines;
}

function textBlob(text: string): Blob {
  return new Blob([text]);
}

function utf16leBytes(text: string, withBom = false) {
  const bytes = new Uint8Array(text.length * 2 + (withBom ? 2 : 0));
  let offset = 0;

  if (withBom) {
    bytes[0] = 0xff;
    bytes[1] = 0xfe;
    offset = 2;
  }

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes[offset] = code & 0xff;
    bytes[offset + 1] = code >> 8;
    offset += 2;
  }

  return bytes;
}

describe("readFileLines", () => {
  it("按 LF 切分且不产生末尾空行", async () => {
    expect(await collect(textBlob("第一行\n第二行\n"))).toEqual([
      "第一行",
      "第二行",
    ]);
  });

  it("把 CRLF 当作一个换行符", async () => {
    expect(await collect(textBlob("a\r\nb\r\n"))).toEqual(["a", "b"]);
  });

  it("支持单独 CR 换行", async () => {
    expect(await collect(textBlob("a\rb\r"))).toEqual(["a", "b"]);
  });

  it("混合换行符也能正确切分", async () => {
    expect(await collect(textBlob("a\r\nb\nc\rd"))).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("保留空行", async () => {
    expect(await collect(textBlob("\n\n"))).toEqual(["", ""]);
    expect(await collect(textBlob("a\n\nb"))).toEqual(["a", "", "b"]);
  });

  it("空文件不产生任何行", async () => {
    expect(await collect(textBlob(""))).toEqual([]);
  });

  it("跨分块边界正确处理 CRLF", async () => {
    expect(await collect(textBlob("a\r\nb"), "utf-8", { chunkSize: 2 })).toEqual(
      ["a", "b"]
    );
  });

  it("跨分块边界保留多字节字符", async () => {
    expect(
      await collect(textBlob("123中文456"), "utf-8", { chunkSize: 4 })
    ).toEqual(["123中文456"]);
  });

  it("默认分隔符跨多个分块也不会错位", async () => {
    const lines = Array.from({ length: 2000 }, (_, index) => `第${index}行`);
    const blob = textBlob(lines.join("\r\n"));

    expect(await collect(blob, "utf-8", { chunkSize: 7 })).toEqual(lines);
  });

  it("去除 UTF-8 BOM", async () => {
    const content = new TextEncoder().encode("第一行");
    const bytes = new Uint8Array(content.length + 3);
    bytes.set([0xef, 0xbb, 0xbf], 0);
    bytes.set(content, 3);

    expect(await collect(new Blob([bytes]))).toEqual(["第一行"]);
  });

  it("支持 UTF-16LE 和 BOM", async () => {
    const bytes = utf16leBytes("第一行\r\n第二行", true);

    expect(await collect(new Blob([bytes]), "utf-16le", { chunkSize: 5 })).toEqual(
      ["第一行", "第二行"]
    );
  });

  it("UTF-16LE 的 CRLF 被分块拆开时不会多出空行", async () => {
    const bytes = utf16leBytes("a\r\nb");

    expect(await collect(new Blob([bytes]), "utf-16le", { chunkSize: 1 })).toEqual(
      ["a", "b"]
    );
  });

  it("不支持的编码抛出 INVALID_ENCODING", async () => {
    await expect(
      collect(textBlob("abc"), "utf-32" as TextEncoding)
    ).rejects.toMatchObject({ code: "INVALID_ENCODING" });

    await expect(
      collect(textBlob("abc"), "utf-32" as TextEncoding)
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("开始前已取消则抛出 AbortError", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      collect(textBlob("abc"), "utf-8", { signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("读取过程中取消会停止产出", async () => {
    const controller = new AbortController();
    const lines: string[] = [];

    await expect(
      (async () => {
        for await (const line of readFileLines(
          textBlob("a\nb\nc"),
          "utf-8",
          { chunkSize: 1, signal: controller.signal }
        )) {
          lines.push(line);
          controller.abort();
        }
      })()
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(lines).toEqual(["a"]);
  });
});
