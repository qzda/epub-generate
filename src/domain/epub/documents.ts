import type { Chapter } from "../chapter";
import { normalizeChapterLevels } from "../chapter";
import { escapeXml } from "./xml";

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

export interface NavItem {
  href: string;
  label: string;
  children?: NavItem[];
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

function renderNavList(items: ReadonlyArray<NavItem>, depth: number): string {
  const indent = "  ".repeat(depth);
  const entries = items
    .map((item) => {
      const children = item.children?.length
        ? `\n${renderNavList(item.children, depth + 1)}\n${indent}  `
        : "";
      return `${indent}  <li><a href="${escapeXml(item.href)}">${escapeXml(item.label)}</a>${children}</li>`;
    })
    .join("\n");

  return `${indent}<ol>\n${entries}\n${indent}</ol>`;
}

export function buildNavDocument(input: NavInput): string {
  return `${XML_DECLARATION}
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(input.language)}" lang="${escapeXml(input.language)}">
<head>
  <title>${escapeXml(input.title)}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${escapeXml(input.title)}</h1>
${renderNavList(input.items, 2)}
  </nav>
</body>
</html>`;
}

function tocDepth(items: ReadonlyArray<NavItem>): number {
  let depth = 0;

  for (const item of items) {
    depth = Math.max(depth, 1 + tocDepth(item.children ?? []));
  }

  return depth;
}

function renderNcxPoints(
  items: ReadonlyArray<NavItem>,
  depth: number,
  state: { playOrder: number }
): string {
  const indent = "  ".repeat(depth);

  return items
    .map((item) => {
      state.playOrder += 1;
      const order = state.playOrder;
      const children = item.children?.length
        ? `\n${renderNcxPoints(item.children, depth + 1, state)}`
        : "";

      return `${indent}<navPoint id="navPoint${order}" playOrder="${order}">
${indent}  <navLabel><text>${escapeXml(item.label)}</text></navLabel>
${indent}  <content src="${escapeXml(item.href)}"/>${children}
${indent}</navPoint>`;
    })
    .join("\n");
}

export function buildNcxDocument(input: NcxInput): string {
  const navPoints = renderNcxPoints(input.items, 2, { playOrder: 0 });
  const depth = Math.max(1, tocDepth(input.items));

  return `${XML_DECLARATION}
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(input.identifier)}"/>
    <meta name="dtb:depth" content="${depth}"/>
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

/**
 * 按标题层级把扁平章节列表转换成嵌套目录。
 * 层级会先归一化，保证首项从一级开始，且不会跳级。
 */
export function buildTocItems(
  chapters: ReadonlyArray<Pick<Chapter, "title" | "level">>,
  href: (index: number) => string
): NavItem[] {
  const levels = normalizeChapterLevels(
    chapters.map((chapter) => chapter.level)
  );
  const roots: NavItem[] = [];
  const stack: NavItem[] = [];

  chapters.forEach((chapter, index) => {
    const level = levels[index] ?? 1;
    const item: NavItem = {
      href: href(index),
      label: chapter.title,
    };

    while (stack.length >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(item);
    } else {
      const parent = stack[stack.length - 1];
      parent.children ??= [];
      parent.children.push(item);
    }

    stack.push(item);
  });

  return roots;
}
