import { describe, expect, it } from "vitest";
import { createBookMeta } from "../book";
import { splitChapters } from "../chapter";
import { DomainError } from "../result";
import { buildTextEpub } from "./build-text";

function textOf(data: string | Uint8Array): string {
  return typeof data === "string" ? data : new TextDecoder().decode(data);
}

const meta = createBookMeta({
  title: "测试书籍",
  author: "测试作者",
  language: "zh",
});

const baseInput = {
  meta,
  identifier: "urn:uuid:test-book",
  modifiedAt: "2026-11-20T00:00:00Z",
  chapters: [
    { title: "第一章", paragraphs: ["第一段", "第二段"] },
    { title: "第二章", paragraphs: [] },
  ],
};

describe("buildTextEpub", () => {
  it("按固定顺序输出所有必需文件", () => {
    const entries = buildTextEpub(baseInput);

    expect(entries.map((entry) => entry.path)).toEqual([
      "mimetype",
      "META-INF/container.xml",
      "OEBPS/content.opf",
      "OEBPS/nav.xhtml",
      "OEBPS/toc.ncx",
      "OEBPS/style.css",
      "OEBPS/chapter0.xhtml",
      "OEBPS/chapter1.xhtml",
    ]);
  });

  it("mimetype 是第一个文件且不压缩", () => {
    const entries = buildTextEpub(baseInput);

    expect(entries[0]).toEqual({
      path: "mimetype",
      data: "application/epub+zip",
      compression: "STORE",
    });
  });

  it("OPF 的 manifest 与 spine 和章节数量一致", () => {
    const entries = buildTextEpub(baseInput);
    const opf = textOf(entries.find((entry) => entry.path === "OEBPS/content.opf")!.data);

    expect(opf).toContain('<item id="chapter0" href="chapter0.xhtml"');
    expect(opf).toContain('<item id="chapter1" href="chapter1.xhtml"');
    expect(opf).toContain('<itemref idref="chapter0"/>');
    expect(opf).toContain('<itemref idref="chapter1"/>');
    expect(opf).toContain('<spine toc="ncx">');
    expect(opf).toContain("urn:uuid:test-book");
  });

  it("没有章节匹配时把全文作为单章「正文」输出", () => {
    const { chapters } = splitChapters(
      ["第一段", "", "第二段"],
      /^第.+章$/
    );
    const entries = buildTextEpub({ ...baseInput, chapters });
    const chapter = textOf(
      entries.find((entry) => entry.path === "OEBPS/chapter0.xhtml")!.data
    );

    expect(chapters).toHaveLength(1);
    expect(chapter).toContain("<h1>正文</h1>");
    expect(chapter).toContain("<p>第一段</p>");
    expect(chapter).toContain("<p>第二段</p>");
  });

  it("始终生成 nav 和 ncx，即使只有一个章节", () => {
    const entries = buildTextEpub({
      ...baseInput,
      chapters: [{ title: "正文", paragraphs: ["内容"] }],
    });
    const paths = entries.map((entry) => entry.path);

    expect(paths).toContain("OEBPS/nav.xhtml");
    expect(paths).toContain("OEBPS/toc.ncx");
  });

  it("章节正文与目录标签正确", () => {
    const entries = buildTextEpub(baseInput);
    const chapter = textOf(
      entries.find((entry) => entry.path === "OEBPS/chapter0.xhtml")!.data
    );
    const nav = textOf(
      entries.find((entry) => entry.path === "OEBPS/nav.xhtml")!.data
    );

    expect(chapter).toContain("<h1>第一章</h1>");
    expect(chapter).toContain("<p>第一段</p>");
    expect(nav).toContain("第一章");
    expect(nav).toContain("第二章");
  });

  it("按标题层级生成嵌套目录", () => {
    const entries = buildTextEpub({
      ...baseInput,
      chapters: [
        { title: "第一部", paragraphs: ["部导语"], level: 1 },
        { title: "第一章", paragraphs: ["正文"], level: 2 },
        { title: "第一节", paragraphs: [], level: 3 },
        { title: "第二部", paragraphs: [], level: 1 },
      ],
    });
    const opf = textOf(entries.find((entry) => entry.path === "OEBPS/content.opf")!.data);
    const nav = textOf(entries.find((entry) => entry.path === "OEBPS/nav.xhtml")!.data);
    const ncx = textOf(entries.find((entry) => entry.path === "OEBPS/toc.ncx")!.data);

    expect(opf.match(/<itemref idref="chapter\d"\/>/g)).toHaveLength(4);
    expect(nav).toContain("第一部</a>\n      <ol>");
    expect(nav).toContain("第一章</a>\n        <ol>");
    expect(ncx).toContain('<meta name="dtb:depth" content="3"/>');
    expect(ncx).toContain('id="navPoint3" playOrder="3"');
  });

  it("转义书籍信息和章节内容", () => {
    const entries = buildTextEpub({
      ...baseInput,
      meta: createBookMeta({ title: "A & B", author: "<作者>" }),
      chapters: [
        {
          title: "1 < 2",
          paragraphs: ["<script>alert('x')</script>"],
        },
      ],
    });
    const opf = textOf(entries.find((entry) => entry.path === "OEBPS/content.opf")!.data);
    const chapter = textOf(
      entries.find((entry) => entry.path === "OEBPS/chapter0.xhtml")!.data
    );

    expect(opf).toContain("<dc:title>A &amp; B</dc:title>");
    expect(opf).toContain("<dc:creator>&lt;作者&gt;</dc:creator>");
    expect(chapter).toContain("<h1>1 &lt; 2</h1>");
    expect(chapter).toContain("&lt;script&gt;");
  });

  it("相同输入生成相同产物", () => {
    expect(buildTextEpub(baseInput)).toEqual(buildTextEpub(baseInput));
  });

  it("没有章节时抛出 NO_CHAPTERS", () => {
    expect.assertions(2);

    try {
      buildTextEpub({ ...baseInput, chapters: [] });
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe("NO_CHAPTERS");
    }
  });
});
