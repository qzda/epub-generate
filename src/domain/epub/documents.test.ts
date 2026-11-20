import { describe, expect, it } from "vitest";
import {
  buildComicPageDocument,
  buildNavDocument,
  buildNcxDocument,
  buildTextChapterDocument,
  buildTocItems,
} from "./documents";

describe("buildNavDocument", () => {
  it("生成 EPUB 3 导航文档", () => {
    const document = buildNavDocument({
      title: "我的书",
      language: "zh",
      items: [
        { href: "chapter0.xhtml", label: "第一章" },
        { href: "chapter1.xhtml", label: "第二章" },
      ],
    });

    expect(document).toContain('xmlns:epub="http://www.idpf.org/2007/ops"');
    expect(document).toContain('<nav epub:type="toc" id="toc">');
    expect(document).toContain('xml:lang="zh"');
    expect(document).toContain('<a href="chapter0.xhtml">第一章</a>');
    expect(document.indexOf("第一章")).toBeLessThan(
      document.indexOf("第二章")
    );
  });

  it("转义标题和目录项", () => {
    const document = buildNavDocument({
      title: "A & B <C>",
      language: "zh",
      items: [{ href: 'a"b.xhtml', label: "<script>" }],
    });

    expect(document).toContain("A &amp; B &lt;C&gt;");
    expect(document).toContain('href="a&quot;b.xhtml"');
    expect(document).toContain("&lt;script&gt;");
    expect(document).not.toContain("<script>");
  });
});

describe("buildNcxDocument", () => {
  it("生成带 playOrder 的 NCX 目录", () => {
    const document = buildNcxDocument({
      title: "我的书",
      identifier: "urn:uuid:123",
      items: [
        { href: "chapter0.xhtml", label: "第一章" },
        { href: "chapter1.xhtml", label: "第二章" },
      ],
    });

    expect(document).toContain('version="2005-1"');
    expect(document).toContain('content="urn:uuid:123"');
    expect(document).toContain('id="navPoint1" playOrder="1"');
    expect(document).toContain('id="navPoint2" playOrder="2"');
    expect(document).toContain('<content src="chapter1.xhtml"/>');
  });

  it("转义标识符、标题和目录项", () => {
    const document = buildNcxDocument({
      title: "A & B",
      identifier: 'id"1',
      items: [{ href: "a&b.xhtml", label: "<第一章>" }],
    });

    expect(document).toContain("A &amp; B");
    expect(document).toContain('content="id&quot;1"');
    expect(document).toContain("&lt;第一章&gt;");
    expect(document).toContain('src="a&amp;b.xhtml"');
  });
});

describe("buildTextChapterDocument", () => {
  it("生成章节 XHTML 并保留段落顺序", () => {
    const document = buildTextChapterDocument({
      chapter: { title: "第一章", paragraphs: ["第一段", "第二段"] },
      language: "zh",
    });

    expect(document).toContain("<h1>第一章</h1>");
    expect(document).toContain("<p>第一段</p>");
    expect(document).toContain("<p>第二段</p>");
    expect(document.indexOf("第一段")).toBeLessThan(
      document.indexOf("第二段")
    );
    expect(document).toContain('href="style.css"');
    expect(document).toContain('xml:lang="zh"');
  });

  it("转义章节标题和正文", () => {
    const document = buildTextChapterDocument({
      chapter: {
        title: '1 < 2 & "3"',
        paragraphs: ["<script>alert('x')</script>"],
      },
      language: "zh",
    });

    expect(document).toContain("1 &lt; 2 &amp; &quot;3&quot;");
    expect(document).toContain("&lt;script&gt;alert(&apos;x&apos;)&lt;/script&gt;");
    expect(document).not.toContain("<script>");
  });

  it("空正文章节只输出标题", () => {
    const document = buildTextChapterDocument({
      chapter: { title: "空章节", paragraphs: [] },
      language: "zh",
    });

    expect(document).toContain("<h1>空章节</h1>");
    expect(document).not.toContain("<p>");
  });
});

describe("buildComicPageDocument", () => {
  it("生成固定版式图片页", () => {
    const document = buildComicPageDocument({
      pageNumber: 2,
      imageHref: "images/image1.png",
      language: "zh",
    });

    expect(document).toContain("<title>Page 2</title>");
    expect(document).toContain('src="images/image1.png"');
    expect(document).toContain('alt="Page 2"');
    expect(document).toContain('content="width=device-width, initial-scale=1.0"');
    expect(document).toContain('xml:lang="zh"');
  });

  it("转义图片路径", () => {
    const document = buildComicPageDocument({
      pageNumber: 1,
      imageHref: 'images/a"b.png',
      language: "zh",
    });

    expect(document).toContain('src="images/a&quot;b.png"');
  });
});

describe("buildTocItems", () => {
  it("按章节顺序生成目录项", () => {
    expect(
      buildTocItems([{ title: "一" }, { title: "二" }], (index) => `p${index}.xhtml`)
    ).toEqual([
      { href: "p0.xhtml", label: "一" },
      { href: "p1.xhtml", label: "二" },
    ]);
  });
});
