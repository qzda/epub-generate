import type { Chapter } from "../chapter";
import { escapeXml } from "./xml";

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

export interface NavItem {
  href: string;
  label: string;
}

export interface NavInput {
  title: string;
  language: string;
  items: NavItem[];
}

export interface NcxInput {
  title: string;
  identifier: string;
  items: NavItem[];
}

export interface TextChapterDocumentInput {
  chapter: Chapter;
  language: string;
}

export interface ComicPageDocumentInput {
  pageNumber: number;
  imageHref: string;
  language: string;
}

export function buildNavDocument(input: NavInput): string {
  const items = input.items
    .map(
      (item) =>
        `        <li><a href="${escapeXml(item.href)}">${escapeXml(item.label)}</a></li>`
    )
    .join("\n");

  return `${XML_DECLARATION}
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(input.language)}" lang="${escapeXml(input.language)}">
<head>
  <title>${escapeXml(input.title)}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${escapeXml(input.title)}</h1>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>`;
}

export function buildNcxDocument(input: NcxInput): string {
  const navPoints = input.items
    .map(
      (item, index) => `    <navPoint id="navPoint${index + 1}" playOrder="${index + 1}">
      <navLabel><text>${escapeXml(item.label)}</text></navLabel>
      <content src="${escapeXml(item.href)}"/>
    </navPoint>`
    )
    .join("\n");

  return `${XML_DECLARATION}
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(input.identifier)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(input.title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
}

export function buildTextChapterDocument(
  input: TextChapterDocumentInput
): string {
  const paragraphs = input.chapter.paragraphs
    .map((paragraph) => `    <p>${escapeXml(paragraph)}</p>`)
    .join("\n");

  return `${XML_DECLARATION}
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(input.language)}" lang="${escapeXml(input.language)}">
<head>
  <title>${escapeXml(input.chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>${escapeXml(input.chapter.title)}</h1>
${paragraphs}
</body>
</html>`;
}

export function buildComicPageDocument(
  input: ComicPageDocumentInput
): string {
  return `${XML_DECLARATION}
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(input.language)}" lang="${escapeXml(input.language)}">
<head>
  <title>Page ${input.pageNumber}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body>
  <img src="${escapeXml(input.imageHref)}" alt="Page ${input.pageNumber}"/>
</body>
</html>`;
}

export function buildTocItems(
  chapters: ReadonlyArray<Pick<Chapter, "title">>,
  href: (index: number) => string
): NavItem[] {
  return chapters.map((chapter, index) => ({
    href: href(index),
    label: chapter.title,
  }));
}
