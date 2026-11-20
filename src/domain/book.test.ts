import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE,
  FALLBACK_BOOK_AUTHOR,
  FALLBACK_BOOK_TITLE,
  createBookMeta,
  sanitizeEpubFileName,
} from "./book";

describe("createBookMeta", () => {
  it("为缺失字段提供默认值", () => {
    expect(createBookMeta()).toEqual({
      title: FALLBACK_BOOK_TITLE,
      author: FALLBACK_BOOK_AUTHOR,
      language: DEFAULT_LANGUAGE,
    });
  });

  it("把空白字段视为缺失", () => {
    expect(
      createBookMeta({ title: "   ", author: "\n", language: "\t" })
    ).toEqual({
      title: FALLBACK_BOOK_TITLE,
      author: FALLBACK_BOOK_AUTHOR,
      language: DEFAULT_LANGUAGE,
    });
  });

  it("去除字段首尾空白并保留内容", () => {
    expect(
      createBookMeta({
        title: "  我的书  ",
        author: " 张三 ",
        language: " en ",
      })
    ).toEqual({
      title: "我的书",
      author: "张三",
      language: "en",
    });
  });
});

describe("sanitizeEpubFileName", () => {
  it("补全 .epub 后缀", () => {
    expect(sanitizeEpubFileName("我的书")).toBe("我的书.epub");
  });

  it("不会重复添加 .epub 后缀", () => {
    expect(sanitizeEpubFileName("我的书.epub")).toBe("我的书.epub");
    expect(sanitizeEpubFileName("我的书.EPUB")).toBe("我的书.epub");
  });

  it("替换文件系统非法字符", () => {
    const result = sanitizeEpubFileName('  a/b:c*?"<>|.txt  ');

    expect(result.endsWith(".epub")).toBe(true);
    expect(result).not.toMatch(/[\\/:*?"<>|]/);
  });

  it("移除控制字符并合并空白", () => {
    expect(sanitizeEpubFileName("a\u0000b\u001fc   d")).toBe("abc d.epub");
  });

  it("移除结尾的点，避免生成异常文件名", () => {
    expect(sanitizeEpubFileName("book...")).toBe("book.epub");
  });

  it("空名称或纯非法字符使用兜底文件名", () => {
    expect(sanitizeEpubFileName("")).toBe("book.epub");
    expect(sanitizeEpubFileName("   ")).toBe("book.epub");
    expect(sanitizeEpubFileName("///")).toBe("book.epub");
    expect(sanitizeEpubFileName("...")).toBe("book.epub");
  });
});
