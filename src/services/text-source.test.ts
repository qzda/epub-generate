import { describe, expect, it } from "vitest";
import { splitChapters } from "../domain/chapter";
import { readTextChapters, scanTextSource } from "./text-source";

const TEXT = [
  "序言第一行",
  "第1章 开始",
  "正文一",
  "",
  "正文二",
  "第2章 结束",
  "结尾",
].join("\n");

function blobOf(text: string): Blob {
  return new Blob([text]);
}

describe("scanTextSource", () => {
  it("同时返回预览、完整章节索引和行数", async () => {
    const result = await scanTextSource(blobOf(TEXT), "utf-8", /^第.+章/, {
      previewLineCount: 2,
    });

    expect(result.previewLines).toEqual(["序言第一行", "第1章 开始"]);
    expect(result.totalLines).toBe(7);
    expect(result.matchedCount).toBe(2);
    expect(result.chapterRefs).toEqual([
      { title: "前言", startLine: 0 },
      { title: "第1章 开始", startLine: 1 },
      { title: "第2章 结束", startLine: 5 },
    ]);
  });

  it("目录索引与 splitChapters 完全一致", async () => {
    const scan = await scanTextSource(blobOf(TEXT), "utf-8", /^第.+章/);
    const expected = splitChapters(TEXT.split("\n"), /^第.+章/);

    expect(scan.chapterRefs).toEqual(expected.refs);
    expect(scan.matchedCount).toBe(expected.matchedCount);
    expect(scan.totalLines).toBe(expected.lineCount);
  });

  it("预览行数不会超过指定上限", async () => {
    const result = await scanTextSource(blobOf(TEXT), "utf-8", /^第.+章/, {
      previewLineCount: 1,
    });

    expect(result.previewLines).toEqual(["序言第一行"]);
  });

  it("空文件返回空结果", async () => {
    expect(
      await scanTextSource(blobOf(""), "utf-8", /^第.+章/)
    ).toEqual({
      previewLines: [],
      chapterRefs: [],
      totalLines: 0,
      matchedCount: 0,
    });
  });

  it("分块读取时结果保持一致", async () => {
    const whole = await scanTextSource(blobOf(TEXT), "utf-8", /^第.+章/);
    const chunked = await scanTextSource(blobOf(TEXT), "utf-8", /^第.+章/, {
      chunkSize: 3,
    });

    expect(chunked).toEqual(whole);
  });

  it("支持取消", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      scanTextSource(blobOf(TEXT), "utf-8", /^第.+章/, {
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("readTextChapters", () => {
  it("保留章节正文，与分章器结果一致", async () => {
    const chapters = await readTextChapters(
      blobOf(TEXT),
      "utf-8",
      /^第.+章/
    );
    const expected = splitChapters(TEXT.split("\n"), /^第.+章/).chapters;

    expect(chapters).toEqual(expected);
    expect(chapters).toHaveLength(3);
    expect(chapters[1].paragraphs).toEqual(["正文一", "正文二"]);
  });

  it("按已处理行数报告进度", async () => {
    const lines = Array.from({ length: 450 }, (_, index) => `第${index + 1}行`);
    const progress: number[] = [];

    await readTextChapters(blobOf(lines.join("\n")), "utf-8", /^第.+章/, {
      onProgress: (processed) => progress.push(processed),
    });

    expect(progress.length).toBeGreaterThan(1);
    expect(progress.at(-1)).toBe(450);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });

  it("支持取消", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      readTextChapters(blobOf(TEXT), "utf-8", /^第.+章/, {
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
