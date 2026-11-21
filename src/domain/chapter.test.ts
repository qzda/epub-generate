import { describe, expect, it } from "vitest";
import {
  FALLBACK_CHAPTER_TITLE,
  MAX_CHAPTER_DEPTH,
  PREAMBLE_TITLE,
  compileChapterPattern,
  compileChapterPatterns,
  createChapterSplitter,
  normalizeChapterLevels,
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

describe("compileChapterPatterns", () => {
  it("每行编译为一级，忽略空行并去除首尾空白", () => {
    const result = compileChapterPatterns(
      "  ^第.+部$ \n\n^第.+章$\n   \n^第.+节$\n"
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(3);
      expect(result.value[0].test("第一部")).toBe(true);
      expect(result.value[1].test("第一章")).toBe(true);
      expect(result.value[2].test("第一节")).toBe(true);
    }
  });

  it("单行正则保持兼容", () => {
    const result = compileChapterPatterns("^第.+章$");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
    }
  });

  it("拒绝空内容和纯空白行", () => {
    for (const source of ["", " \n\t\n "]) {
      const result = compileChapterPatterns(source);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("不能为空");
      }
    }
  });

  it("最多支持三级正则", () => {
    const result = compileChapterPatterns("a\nb\nc\nd");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain(`最多支持 ${MAX_CHAPTER_DEPTH} 级`);
    }
  });

  it("语法错误会指出级数", () => {
    const result = compileChapterPatterns("^一$\n(");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("第 2 级标题正则无效");
    }
  });
});

describe("normalizeChapterLevels", () => {
  it("空列表返回空数组", () => {
    expect(normalizeChapterLevels([])).toEqual([]);
  });

  it("整体提升到从一级开始", () => {
    expect(normalizeChapterLevels([2, 2, 2])).toEqual([1, 1, 1]);
    expect(normalizeChapterLevels([3, 3])).toEqual([1, 1]);
  });

  it("保持连续层级", () => {
    expect(normalizeChapterLevels([1, 2, 3, 2, 1])).toEqual([
      1, 2, 3, 2, 1,
    ]);
  });

  it("跳级时只下探一级", () => {
    expect(normalizeChapterLevels([1, 3, 3])).toEqual([1, 2, 2]);
  });

  it("无效层级按一级处理", () => {
    expect(
      normalizeChapterLevels([Number.NaN, undefined, Number.POSITIVE_INFINITY])
    ).toEqual([1, 1, 1]);
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
      { title: PREAMBLE_TITLE, paragraphs: ["序言第一行"], level: 1 },
      { title: "第1章 开始", paragraphs: ["内容一", "内容二"], level: 1 },
      { title: "第2章 结束", paragraphs: ["结尾"], level: 1 },
    ]);
    expect(result.refs).toEqual([
      { title: PREAMBLE_TITLE, startLine: 0, level: 1 },
      { title: "第1章 开始", startLine: 2, level: 1 },
      { title: "第2章 结束", startLine: 6, level: 1 },
    ]);
  });

  it("标题行不进入章节正文，并去除标题首尾空白", () => {
    const result = splitChapters(["  第1章 开始  ", "正文"], /第.+章/);

    expect(result.chapters).toEqual([
      { title: "第1章 开始", paragraphs: ["正文"], level: 1 },
    ]);
    expect(result.refs).toEqual([
      { title: "第1章 开始", startLine: 0, level: 1 },
    ]);
  });

  it("支持带捕获组的正则，标题仍取整行", () => {
    const result = splitChapters(
      ["第1章 开始", "内容", "第2章 结束"],
      /^(第(.+)章)\s*(.*)$/
    );

    expect(result.matchedCount).toBe(2);
    expect(result.chapters).toEqual([
      { title: "第1章 开始", paragraphs: ["内容"], level: 1 },
      { title: "第2章 结束", paragraphs: [], level: 1 },
    ]);
  });

  it("连续标题会保留空章节", () => {
    const result = splitChapters(["第一章", "第二章", "内容"], /^第.+章$/);

    expect(result.chapters).toEqual([
      { title: "第一章", paragraphs: [], level: 1 },
      { title: "第二章", paragraphs: ["内容"], level: 1 },
    ]);
  });

  it("没有匹配时生成单独的正文章节", () => {
    const result = splitChapters(["第一段", "", "第二段"], /^第.+章$/);

    expect(result.matchedCount).toBe(0);
    expect(result.chapters).toEqual([
      {
        title: FALLBACK_CHAPTER_TITLE,
        paragraphs: ["第一段", "第二段"],
        level: 1,
      },
    ]);
    expect(result.refs).toEqual([
      { title: FALLBACK_CHAPTER_TITLE, startLine: 0, level: 1 },
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
      { title: PREAMBLE_TITLE, paragraphs: [], level: 1 },
      { title: "第1章", paragraphs: [], level: 1 },
      { title: "第2章", paragraphs: [], level: 1 },
    ]);
    expect(result.matchedCount).toBe(2);
    expect(result.refs).toEqual([
      { title: PREAMBLE_TITLE, startLine: 0, level: 1 },
      { title: "第1章", startLine: 1, level: 1 },
      { title: "第2章", startLine: 3, level: 1 },
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
      level: 1,
    });
    expect(fallback.chapters[0]).toEqual({
      title: FALLBACK_CHAPTER_TITLE,
      paragraphs: [],
      level: 1,
    });
  });

  it("前言起始行会跳过开头的空白行", () => {
    const result = splitChapters(["", "  ", "序言", "第1章"], /^第.+章$/);

    expect(result.refs[0]).toEqual({
      title: PREAMBLE_TITLE,
      startLine: 2,
      level: 1,
    });
  });

  it("扫描模式下前言的起始行仍取第一行内容", () => {
    const result = splitChapters(
      ["", "第一行", "第二行", "第1章"],
      /^第.+章$/,
      { keepContent: false }
    );

    expect(result.refs[0]).toEqual({
      title: PREAMBLE_TITLE,
      startLine: 1,
      level: 1,
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
      { title: "a", paragraphs: [], level: 1 },
      { title: "b", paragraphs: [], level: 1 },
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
      { title: "第1章", paragraphs: ["内容"], level: 1 },
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

describe("多级标题", () => {
  const patterns = [
    /^第.+部(?:\s|$)/,
    /^第.+章(?:\s|$)/,
    /^第.+节(?:\s|$)/,
  ];

  it("按部、章、节生成三级结构", () => {
    const result = splitChapters(
      [
        "前言内容",
        "第一部 风起",
        "部导语",
        "第一章 开始",
        "章导语",
        "第一节 细节",
        "节内容",
        "第二节 继续",
        "第二章 转折",
        "第二部 落幕",
        "第一章 再起",
      ],
      patterns
    );

    expect(result.matchedCount).toBe(7);
    expect(result.chapters).toEqual([
      { title: PREAMBLE_TITLE, paragraphs: ["前言内容"], level: 1 },
      { title: "第一部 风起", paragraphs: ["部导语"], level: 1 },
      { title: "第一章 开始", paragraphs: ["章导语"], level: 2 },
      { title: "第一节 细节", paragraphs: ["节内容"], level: 3 },
      { title: "第二节 继续", paragraphs: [], level: 3 },
      { title: "第二章 转折", paragraphs: [], level: 2 },
      { title: "第二部 落幕", paragraphs: [], level: 1 },
      { title: "第一章 再起", paragraphs: [], level: 2 },
    ]);
    expect(result.refs.map((ref) => ref.level)).toEqual([
      1, 1, 2, 3, 3, 2, 1, 2,
    ]);
  });

  it("只有章节时整体提升为一级", () => {
    const result = splitChapters(
      ["第一章", "内容", "第二章"],
      [/^第.+部$/, /^第.+章$/]
    );

    expect(result.chapters.map((chapter) => chapter.level)).toEqual([
      1, 1,
    ]);
  });

  it("只有章和节时，节作为二级", () => {
    const result = splitChapters(
      ["第一章", "内容", "第一节", "细节", "第二节"],
      patterns
    );

    expect(result.chapters.map((chapter) => chapter.level)).toEqual([
      1, 2, 2,
    ]);
  });

  it("跳级会压到下一级", () => {
    const result = splitChapters(["第一部", "第一节"], patterns);

    expect(result.chapters.map((chapter) => chapter.level)).toEqual([
      1, 2,
    ]);
  });

  it("靠前的正则优先于靠后的正则", () => {
    const result = splitChapters(
      ["第一章", "第二章"],
      [/^第.+[部章]$/, /^第.+章$/]
    );

    expect(result.chapters.map((chapter) => chapter.level)).toEqual([
      1, 1,
    ]);
  });

  it("拒绝空正则列表和超过三级的输入", () => {
    expect(() => createChapterSplitter([])).toThrow("至少需要一个章节正则");
    expect(() =>
      createChapterSplitter([/a/, /b/, /c/, /d/])
    ).toThrow(`最多支持 ${MAX_CHAPTER_DEPTH} 级`);
  });
});
