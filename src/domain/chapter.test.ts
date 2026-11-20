import { describe, expect, it } from "vitest";
import {
  FALLBACK_CHAPTER_TITLE,
  PREAMBLE_TITLE,
  compileChapterPattern,
  createChapterSplitter,
  splitChapters,
} from "./chapter";

describe("compileChapterPattern", () => {
  it("编译有效正则且不带 g/y 标志", () => {
    const result = compileChapterPattern("^第.+章$");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.test("第一章")).toBe(true);
      expect(result.value.global).toBe(false);
      expect(result.value.sticky).toBe(false);
    }
  });

  it("拒绝空正则和纯空白正则", () => {
    for (const source of ["", "   ", "\n\t"]) {
      const result = compileChapterPattern(source);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_PATTERN");
      }
    }
  });

  it("拒绝语法错误的正则", () => {
    const result = compileChapterPattern("(");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PATTERN");
      expect(result.error.message).toContain("章节正则无效");
    }
  });
});

describe("splitChapters", () => {
  it("切分前言和章节，并丢弃空白行", () => {
    const result = splitChapters(
      ["序言第一行", "", "第1章 开始", "内容一", "   ", "内容二", "第2章 结束", "结尾"],
      /^第.+章/
    );

    expect(result.matchedCount).toBe(2);
    expect(result.lineCount).toBe(8);
    expect(result.chapters).toEqual([
      { title: PREAMBLE_TITLE, paragraphs: ["序言第一行"] },
      { title: "第1章 开始", paragraphs: ["内容一", "内容二"] },
      { title: "第2章 结束", paragraphs: ["结尾"] },
    ]);
    expect(result.refs).toEqual([
      { title: PREAMBLE_TITLE, startLine: 0 },
      { title: "第1章 开始", startLine: 2 },
      { title: "第2章 结束", startLine: 6 },
    ]);
  });

  it("标题行不进入章节正文，并去除标题首尾空白", () => {
    const result = splitChapters(["  第1章 开始  ", "正文"], /第.+章/);

    expect(result.chapters).toEqual([
      { title: "第1章 开始", paragraphs: ["正文"] },
    ]);
    expect(result.refs).toEqual([{ title: "第1章 开始", startLine: 0 }]);
  });

  it("支持带捕获组的正则，标题仍取整行", () => {
    const result = splitChapters(
      ["第1章 开始", "内容", "第2章 结束"],
      /^(第(.+)章)\s*(.*)$/
    );

    expect(result.matchedCount).toBe(2);
    expect(result.chapters).toEqual([
      { title: "第1章 开始", paragraphs: ["内容"] },
      { title: "第2章 结束", paragraphs: [] },
    ]);
  });

  it("连续标题会保留空章节", () => {
    const result = splitChapters(["第一章", "第二章", "内容"], /^第.+章$/);

    expect(result.chapters).toEqual([
      { title: "第一章", paragraphs: [] },
      { title: "第二章", paragraphs: ["内容"] },
    ]);
  });

  it("没有匹配时生成单独的正文章节", () => {
    const result = splitChapters(["第一段", "", "第二段"], /^第.+章$/);

    expect(result.matchedCount).toBe(0);
    expect(result.chapters).toEqual([
      { title: FALLBACK_CHAPTER_TITLE, paragraphs: ["第一段", "第二段"] },
    ]);
    expect(result.refs).toEqual([
      { title: FALLBACK_CHAPTER_TITLE, startLine: 0 },
    ]);
  });

  it("空输入和纯空白输入不生成章节", () => {
    expect(splitChapters([], /^第.+章$/).chapters).toEqual([]);
    expect(splitChapters(["", "   ", "\n"], /^第.+章$/).chapters).toEqual([]);
  });

  it("keepContent=false 时只保留结构信息", () => {
    const result = splitChapters(
      ["序言", "第1章", "内容", "第2章"],
      /^第.+章$/,
      { keepContent: false }
    );

    expect(result.chapters).toEqual([
      { title: PREAMBLE_TITLE, paragraphs: [] },
      { title: "第1章", paragraphs: [] },
      { title: "第2章", paragraphs: [] },
    ]);
    expect(result.matchedCount).toBe(2);
    expect(result.refs).toEqual([
      { title: PREAMBLE_TITLE, startLine: 0 },
      { title: "第1章", startLine: 1 },
      { title: "第2章", startLine: 3 },
    ]);
  });

  it("即使跳过内容收集，也能识别前言和正文兜底", () => {
    const preamble = splitChapters(["序言", "第1章"], /^第.+章$/, {
      keepContent: false,
    });
    const fallback = splitChapters(["正文"], /^第.+章$/, {
      keepContent: false,
    });

    expect(preamble.chapters[0]).toEqual({
      title: PREAMBLE_TITLE,
      paragraphs: [],
    });
    expect(fallback.chapters[0]).toEqual({
      title: FALLBACK_CHAPTER_TITLE,
      paragraphs: [],
    });
  });

  it("前言起始行会跳过开头的空白行", () => {
    const result = splitChapters(["", "  ", "序言", "第1章"], /^第.+章$/);

    expect(result.refs[0]).toEqual({
      title: PREAMBLE_TITLE,
      startLine: 2,
    });
  });

  it("忽略正则自带的 g/y 标志，避免 lastIndex 污染", () => {
    const splitter = createChapterSplitter(/^第.+章$/g);

    expect(splitter.push("第1章")).toBe(true);
    expect(splitter.push("第2章")).toBe(true);
    expect(splitter.finish().matchedCount).toBe(2);
  });

  it("每一行都匹配时保留标题和空正文", () => {
    const result = splitChapters(["a", "b"], /.+/);

    expect(result.chapters).toEqual([
      { title: "a", paragraphs: [] },
      { title: "b", paragraphs: [] },
    ]);
  });

  it("finish 可重复调用且结果稳定", () => {
    const splitter = createChapterSplitter(/^第.+章$/);
    splitter.push("第1章");
    splitter.push("内容");

    const first = splitter.finish();
    const second = splitter.finish();

    expect(second).toEqual(first);
    expect(second.chapters).toEqual([
      { title: "第1章", paragraphs: ["内容"] },
    ]);
  });

  it("finish 之后禁止继续写入", () => {
    const splitter = createChapterSplitter(/^第.+章$/);
    splitter.finish();

    expect(() => splitter.push("第1章")).toThrow("分章器已经结束");
  });

  it("保留正文原始空白，只过滤空白行", () => {
    const result = splitChapters(["第1章", "  缩进内容  "], /^第.+章$/);

    expect(result.chapters[0].paragraphs).toEqual(["  缩进内容  "]);
  });
});
