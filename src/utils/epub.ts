import JSZip from "jszip";
import type { Chapter } from "../types";
import { readFileLinesWithEncoding } from "./file";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function generateEpub(
  file: File,
  regex: string,
  encoding: string,
  exportFileName: string,
  bookInfo: {
    name: string;
    author: string;
  }
) {
  try {
    const chapters: Chapter[] = [];
    let currentChapter: Chapter | null = null;

    // 使用当前选择的编码重新创建文件读取器
    const fileReader = readFileLinesWithEncoding(file, encoding);

    for await (const line of fileReader) {
      const match = line.match(regex);

      if (match) {
        // 保存上一章
        if (currentChapter && currentChapter.content.length > 0) {
          chapters.push(currentChapter);
        }
        // 开始新章节
        currentChapter = {
          title: line.trim(),
          content: [],
        };
      } else if (currentChapter) {
        // 添加内容到当前章节
        if (line.trim()) {
          currentChapter.content.push(line);
        }
      } else {
        // 如果还没有章节，创建一个"序言"章节
        if (!currentChapter) {
          currentChapter = {
            title: "序言",
            content: [],
          };
        }
        if (line.trim()) {
          currentChapter.content.push(line);
        }
      }
    }

    // 添加最后一章
    if (currentChapter && currentChapter.content.length > 0) {
      chapters.push(currentChapter);
    }

    if (chapters.length === 0) {
      alert("未能识别到任何章节，请检查正则表达式");
      return;
    }

    // 使用 JSZip 手动构建 EPUB
    const zip = new JSZip();

    // mimetype 文件必须是第一个且未压缩
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

    // META-INF/container.xml
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
            <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
          </rootfiles>
        </container>`
    );

    // OEBPS/content.opf
    const manifestItems = chapters
      .map(
        (_, i) =>
          `<item id="chapter${i}" href="chapter${i}.xhtml" media-type="application/xhtml+xml"/>`
      )
      .join("\n");

    const spineItems = chapters
      .map((_, i) => `<itemref idref="chapter${i}"/>`)
      .join("\n");

    zip.file(
      "OEBPS/content.opf",
      `<?xml version="1.0" encoding="UTF-8"?>
          <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
            <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
              <dc:title>${escapeXml(bookInfo.name)}</dc:title>
              <dc:creator>${escapeXml(bookInfo.author)}</dc:creator>
              <dc:language>zh</dc:language>
              <dc:identifier id="BookId">${Date.now()}</dc:identifier>
            </metadata>
            <manifest>
              <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
              <item id="style" href="style.css" media-type="text/css"/>
              ${manifestItems}
            </manifest>
            <spine toc="ncx">
              ${spineItems}
            </spine>
          </package>`
    );

    // OEBPS/toc.ncx
    const navPoints = chapters
      .map(
        (ch, i) =>
          `<navPoint id="chapter${i}" playOrder="${i + 1}">
              <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
              <content src="chapter${i}.xhtml"/>
            </navPoint>`
      )
      .join("\n");

    zip.file(
      "OEBPS/toc.ncx",
      `<?xml version="1.0" encoding="UTF-8"?>
        <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
          <head>
            <meta name="dtb:uid" content="${Date.now()}"/>
            <meta name="dtb:depth" content="1"/>
          </head>
          <docTitle><text>${escapeXml(bookInfo.name)}</text></docTitle>
          <navMap>${navPoints}</navMap>
        </ncx>`
    );

    // OEBPS/style.css
    zip.file(
      "OEBPS/style.css",
      `body {
          font-family: "Noto Serif SC", "SimSun", serif;
          line-height: 1.8;
          margin: 2em;
        }
        h1 {
          text-align: center;
          font-size: 1.5em;
          margin: 2em 0 1em 0;
        }
        p {
          text-indent: 2em;
          margin: 0.5em 0;
        }`
    );

    // 生成各章节 XHTML 文件
    chapters.forEach((ch, i) => {
      const content = ch.content
        .map((line) => `<p>${escapeXml(line)}</p>`)
        .join("\n");

      zip.file(
        `OEBPS/chapter${i}.xhtml`,
        `<?xml version="1.0" encoding="UTF-8"?>
          <!DOCTYPE html>
          <html xmlns="http://www.w3.org/1999/xhtml">
          <head>
            <title>${escapeXml(ch.title)}</title>
            <link rel="stylesheet" type="text/css" href="style.css"/>
          </head>
          <body>
            <h1>${escapeXml(ch.title)}</h1>
            ${content}
          </body>
          </html>`
      );
    });

    // 生成 EPUB 文件
    const blob = await zip.generateAsync({ type: "blob" });

    // 下载文件
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFileName}.epub`;
    a.click();
    URL.revokeObjectURL(url);

    alert(`EPUB 生成成功！共 ${chapters.length} 章`);
  } catch (error) {
    console.error("生成 EPUB 失败:", error);
    alert("生成失败：" + (error as Error).message);
  }
}
