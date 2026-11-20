import { describe, expect, it } from "vitest";
import { createBookMeta } from "../book";
import { DomainError } from "../result";
import { buildComicEpub } from "./build-comic";
import type { ComicImageData } from "./types";

function textOf(data: string | Uint8Array): string {
  return typeof data === "string" ? data : new TextDecoder().decode(data);
}

const meta = createBookMeta({
  title: "漫画书",
  author: "作者",
  language: "zh",
});

const images: ComicImageData[] = [
  {
    path: "pages/1.JPG",
    baseName: "1.JPG",
    extension: ".jpg",
    mimeType: "image/jpeg",
    data: new Uint8Array([1, 2, 3]),
  },
  {
    path: "pages/2.png",
    baseName: "2.png",
    extension: ".png",
    mimeType: "image/png",
    data: new Uint8Array([4, 5, 6]),
  },
];

const baseInput = {
  meta,
  identifier: "urn:uuid:comic",
  modifiedAt: "2026-11-20T00:00:00Z",
  images,
};

describe("buildComicEpub", () => {
  it("按固定顺序输出页面和图片", () => {
    const entries = buildComicEpub(baseInput);

    expect(entries.map((entry) => entry.path)).toEqual([
      "mimetype",
      "META-INF/container.xml",
      "OEBPS/content.opf",
      "OEBPS/nav.xhtml",
      "OEBPS/toc.ncx",
      "OEBPS/style.css",
      "OEBPS/page0.xhtml",
      "OEBPS/page1.xhtml",
      "OEBPS/images/image0.jpg",
      "OEBPS/images/image1.png",
    ]);
  });

  it("mimetype 是第一个文件且不压缩", () => {
    expect(buildComicEpub(baseInput)[0]).toEqual({
      path: "mimetype",
      data: "application/epub+zip",
      compression: "STORE",
    });
  });

  it("OPF 包含页面、图片和固定版式元数据", () => {
    const entries = buildComicEpub(baseInput);
    const opf = textOf(entries.find((entry) => entry.path === "OEBPS/content.opf")!.data);

    expect(opf).toContain('<item id="page0" href="page0.xhtml"');
    expect(opf).toContain(
      '<item id="img0" href="images/image0.jpg" media-type="image/jpeg"/>'
    );
    expect(opf).toContain(
      '<item id="img1" href="images/image1.png" media-type="image/png"/>'
    );
    expect(opf).toContain('<itemref idref="page0"/>');
    expect(opf).toContain('<itemref idref="page1"/>');
    expect(opf).toContain(
      '<meta property="rendition:layout">pre-paginated</meta>'
    );
    expect(opf).toContain('<meta property="rendition:orientation">auto</meta>');
    expect(opf).toContain('<meta property="rendition:spread">none</meta>');
  });

  it("页面引用正确的图片路径，目录按页码命名", () => {
    const entries = buildComicEpub(baseInput);
    const firstPage = textOf(
      entries.find((entry) => entry.path === "OEBPS/page0.xhtml")!.data
    );
    const nav = textOf(
      entries.find((entry) => entry.path === "OEBPS/nav.xhtml")!.data
    );
    const ncx = textOf(
      entries.find((entry) => entry.path === "OEBPS/toc.ncx")!.data
    );

    expect(firstPage).toContain('src="images/image0.jpg"');
    expect(nav).toContain(">Page 1<");
    expect(nav).toContain(">Page 2<");
    expect(ncx).toContain('playOrder="1"');
    expect(ncx).toContain('playOrder="2"');
  });

  it("原样保留图片字节", () => {
    const entries = buildComicEpub(baseInput);

    expect(
      entries.find((entry) => entry.path === "OEBPS/images/image0.jpg")!.data
    ).toEqual(new Uint8Array([1, 2, 3]));
    expect(
      entries.find((entry) => entry.path === "OEBPS/images/image1.png")!.data
    ).toEqual(new Uint8Array([4, 5, 6]));
  });

  it("把扩展名统一为小写", () => {
    const entries = buildComicEpub({
      ...baseInput,
      images: [
        {
          path: "1.JPG",
          baseName: "1.JPG",
          extension: ".JPG",
          mimeType: "image/jpeg",
          data: new Uint8Array([1]),
        },
      ],
    });

    expect(entries.map((entry) => entry.path)).toContain(
      "OEBPS/images/image0.jpg"
    );
  });

  it("相同输入生成相同产物", () => {
    expect(buildComicEpub(baseInput)).toEqual(buildComicEpub(baseInput));
  });

  it("没有图片时抛出 NO_IMAGES", () => {
    expect.assertions(2);

    try {
      buildComicEpub({ ...baseInput, images: [] });
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe("NO_IMAGES");
    }
  });
});
