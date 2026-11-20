import { describe, expect, it } from "vitest";
import {
  buildComicStyleSheet,
  buildContainerDocument,
  buildContentOpf,
  buildTextStyleSheet,
} from "./package";

describe("buildContainerDocument", () => {
  it("指向 OEBPS/content.opf", () => {
    const document = buildContainerDocument();

    expect(document).toContain('<rootfile full-path="OEBPS/content.opf"');
    expect(document).toContain('media-type="application/oebps-package+xml"');
  });
});

describe("buildContentOpf", () => {
  const baseInput = {
    meta: { title: "我的书", author: "张三", language: "zh" },
    identifier: "urn:uuid:test",
    modifiedAt: "2026-11-20T00:00:00Z",
    manifest: [
      {
        id: "nav",
        href: "nav.xhtml",
        mediaType: "application/xhtml+xml",
        properties: ["nav"],
      },
      {
        id: "chapter0",
        href: "chapter0.xhtml",
        mediaType: "application/xhtml+xml",
      },
    ],
    spine: ["chapter0"],
  };

  it("生成 EPUB 3 package 文档", () => {
    const document = buildContentOpf(baseInput);

    expect(document).toContain('version="3.0"');
    expect(document).toContain('unique-identifier="BookId"');
    expect(document).toContain("<dc:title>我的书</dc:title>");
    expect(document).toContain("<dc:creator>张三</dc:creator>");
    expect(document).toContain("<dc:language>zh</dc:language>");
    expect(document).toContain(
      '<dc:identifier id="BookId">urn:uuid:test</dc:identifier>'
    );
    expect(document).toContain(
      '<meta property="dcterms:modified">2026-11-20T00:00:00Z</meta>'
    );
  });

  it("输出 manifest 属性、spine 顺序和 NCX 关联", () => {
    const document = buildContentOpf(baseInput);

    expect(document).toContain(
      '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
    );
    expect(document).toContain(
      '<item id="chapter0" href="chapter0.xhtml" media-type="application/xhtml+xml"/>'
    );
    expect(document).toContain('<spine toc="ncx">');
    expect(document).toContain('<itemref idref="chapter0"/>');
  });

  it("转义元数据和清单字段", () => {
    const document = buildContentOpf({
      ...baseInput,
      meta: { title: "A & B", author: "<作者>", language: "zh" },
      identifier: 'id"1',
      manifest: [
        {
          id: 'a"b',
          href: "a&b.xhtml",
          mediaType: 'type"x',
          properties: ["nav", 'prop"x'],
        },
      ],
      spine: ['id"ref'],
    });

    expect(document).toContain("<dc:title>A &amp; B</dc:title>");
    expect(document).toContain("<dc:creator>&lt;作者&gt;</dc:creator>");
    expect(document).toContain("id&quot;1");
    expect(document).toContain('id="a&quot;b"');
    expect(document).toContain('href="a&amp;b.xhtml"');
    expect(document).toContain('media-type="type&quot;x"');
    expect(document).toContain('properties="nav prop&quot;x"');
    expect(document).toContain('idref="id&quot;ref"');
  });

  it("渲染额外的 rendition 元数据", () => {
    const document = buildContentOpf({
      ...baseInput,
      extraMetadata: [
        { property: "rendition:layout", value: "pre-paginated" },
        { property: "rendition:orientation", value: "auto" },
      ],
    });

    expect(document).toContain(
      '<meta property="rendition:layout">pre-paginated</meta>'
    );
    expect(document).toContain(
      '<meta property="rendition:orientation">auto</meta>'
    );
  });
});

describe("样式表", () => {
  it("文本样式面向正文排版", () => {
    const style = buildTextStyleSheet();

    expect(style).toContain("font-family");
    expect(style).toContain("text-indent: 2em");
  });

  it("漫画样式面向整页图片", () => {
    const style = buildComicStyleSheet();

    expect(style).toContain("text-align: center");
    expect(style).toContain("max-height: 100vh");
  });
});
