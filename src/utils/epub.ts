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

function getBaseName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() || path;
}

function createNavXhtml(
  title: string,
  navItems: Array<{ href: string; label: string }>
): string {
  const items = navItems
    .map((item) => `<li><a href="${item.href}">${escapeXml(item.label)}</a></li>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(title)}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${escapeXml(title)}</h1>
    <ol>
      ${items}
    </ol>
  </nav>
</body>
</html>`;
}

type BookInfoBook = {
  type: "book";
  name: string;
  author: string;
  option: {
    regex: string;
    encoding: string;
  };
};

type BookInfoComic = {
  type: "comic";
  name: string;
  author: string;
};

export async function generateEpub(
  file: File,
  exportFileName: string,
  bookInfo: BookInfoBook | BookInfoComic
) {
  const { type } = bookInfo;

  if (type === "book") {
    const { encoding, regex } = bookInfo.option;

    try {
      let chapterRegex: RegExp;
      try {
        chapterRegex = new RegExp(regex);
      } catch {
        alert("章节正则表达式无效，请检查后重试");
        return;
      }

      const bookId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`;
      const modifiedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

      const chapters: Chapter[] = [];
      let currentChapter: Chapter | null = null;
      let matchedChapterCount = 0;

      // 使用当前选择的编码重新创建文件读取器
      const fileReader = readFileLinesWithEncoding(file, encoding);

      for await (const line of fileReader) {
        const match = line.match(chapterRegex);

        if (match) {
          matchedChapterCount++;
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
      const hasToc = matchedChapterCount > 0;
      if (!hasToc && chapters.length === 1) {
        chapters[0].title = "正文";
      }
      const tocManifestItems = hasToc
        ? `
              <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
              <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`
        : "";

      zip.file(
        "OEBPS/content.opf",
        `<?xml version="1.0" encoding="UTF-8"?>
          <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
            <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
              <dc:title>${escapeXml(bookInfo.name)}</dc:title>
              <dc:creator>${escapeXml(bookInfo.author)}</dc:creator>
              <dc:language>zh</dc:language>
              <dc:identifier id="BookId">${bookId}</dc:identifier>
              <meta property="dcterms:modified">${modifiedAt}</meta>
            </metadata>
            <manifest>
              ${tocManifestItems}
              <item id="style" href="style.css" media-type="text/css"/>
              ${manifestItems}
            </manifest>
            <spine>
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

      if (hasToc) {
        zip.file(
          "OEBPS/toc.ncx",
          `<?xml version="1.0" encoding="UTF-8"?>
          <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
            <head>
              <meta name="dtb:uid" content="${bookId}"/>
              <meta name="dtb:depth" content="1"/>
            </head>
            <docTitle><text>${escapeXml(bookInfo.name)}</text></docTitle>
            <navMap>${navPoints}</navMap>
          </ncx>`
        );

        zip.file(
          "OEBPS/nav.xhtml",
          createNavXhtml(
            bookInfo.name,
            chapters.map((ch, i) => ({
              href: `chapter${i}.xhtml`,
              label: ch.title,
            }))
          )
        );
      }

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
        const heading = hasToc ? `<h1>${escapeXml(ch.title)}</h1>` : "";

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
            ${heading}
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

  if (type === "comic") {
    try {
      const bookId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`;
      const modifiedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

      // 读取压缩包
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // 获取所有图片文件
      const imageFiles: Array<{ name: string; data: JSZip.JSZipObject }> = [];
      const imageExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".bmp",
      ];

      zip.forEach((relativePath, file) => {
        if (!file.dir) {
          const ext = relativePath
            .toLowerCase()
            .slice(relativePath.lastIndexOf("."));
          if (imageExtensions.includes(ext)) {
            imageFiles.push({ name: relativePath, data: file });
          }
        }
      });

      if (imageFiles.length === 0) {
        alert("压缩包中没有找到图片文件");
        return;
      }

      // 按文件名排序
      const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: "base",
      });
      imageFiles.sort((a, b) => {
        const baseCompare = collator.compare(getBaseName(a.name), getBaseName(b.name));
        if (baseCompare !== 0) {
          return baseCompare;
        }
        return collator.compare(a.name, b.name);
      });

      // 创建 EPUB
      const epubZip = new JSZip();

      // mimetype
      epubZip.file("mimetype", "application/epub+zip", {
        compression: "STORE",
      });

      // META-INF/container.xml
      epubZip.file(
        "META-INF/container.xml",
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
      );

      // 获取图片的 MIME 类型
      const getMimeType = (filename: string): string => {
        const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
        const mimeTypes: Record<string, string> = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".bmp": "image/bmp",
        };
        return mimeTypes[ext] || "image/jpeg";
      };

      // 复制图片到 EPUB 并生成页面
      const pages: Array<{
        index: number;
        imageName: string;
        mimeType: string;
      }> = [];

      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        const imageData = await imageFile.data.async("uint8array");
        const ext = imageFile.name.slice(imageFile.name.lastIndexOf("."));
        const imageName = `image${i}${ext}`;
        const mimeType = getMimeType(imageFile.name);

        // 保存图片
        epubZip.file(`OEBPS/images/${imageName}`, imageData);

        pages.push({ index: i, imageName, mimeType });
      }

      // OEBPS/content.opf
      const manifestItems = [
        ...pages.map(
          (p) =>
            `    <item id="page${p.index}" href="page${p.index}.xhtml" media-type="application/xhtml+xml"/>`
        ),
        ...pages.map(
          (p) =>
            `    <item id="img${p.index}" href="images/${p.imageName}" media-type="${p.mimeType}"/>`
        ),
      ].join("\n");

      const spineItems = pages
        .map((p) => `    <itemref idref="page${p.index}"/>`)
        .join("\n");

      epubZip.file(
        "OEBPS/content.opf",
        `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(bookInfo.name)}</dc:title>
    <dc:creator>${escapeXml(bookInfo.author)}</dc:creator>
    <dc:language>zh</dc:language>
    <dc:identifier id="BookId">${bookId}</dc:identifier>
    <meta property="dcterms:modified">${modifiedAt}</meta>
    <meta property="rendition:layout">pre-paginated</meta>
    <meta property="rendition:orientation">auto</meta>
    <meta property="rendition:spread">none</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>
${manifestItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>`
      );

      // OEBPS/toc.ncx
      const navPoints = pages
        .map(
          (p) =>
            `    <navPoint id="page${p.index}" playOrder="${p.index + 1}">
      <navLabel><text>Page ${p.index + 1}</text></navLabel>
      <content src="page${p.index}.xhtml"/>
    </navPoint>`
        )
        .join("\n");

      epubZip.file(
        "OEBPS/toc.ncx",
        `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookId}"/>
    <meta name="dtb:depth" content="1"/>
  </head>
  <docTitle><text>${escapeXml(bookInfo.name)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`
      );

      epubZip.file(
        "OEBPS/nav.xhtml",
        createNavXhtml(
          bookInfo.name,
          pages.map((p) => ({
            href: `page${p.index}.xhtml`,
            label: `Page ${p.index + 1}`,
          }))
        )
      );

      // OEBPS/style.css - 漫画专用样式
      epubZip.file(
        "OEBPS/style.css",
        `body {
  margin: 0;
  padding: 0;
  text-align: center;
}
img {
  max-width: 100%;
  max-height: 100vh;
  margin: 0 auto;
  display: block;
}`
      );

      // 生成每一页的 XHTML
      pages.forEach((p) => {
        epubZip.file(
          `OEBPS/page${p.index}.xhtml`,
          `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Page ${p.index + 1}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body>
  <img src="images/${p.imageName}" alt="Page ${p.index + 1}"/>
</body>
</html>`
        );
      });

      // 生成 EPUB 文件
      const blob = await epubZip.generateAsync({
        type: "blob",
        mimeType: "application/epub+zip",
      });

      // 下载文件
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      let fileName = exportFileName;
      if (!fileName.toLowerCase().endsWith(".epub")) {
        fileName = `${fileName}.epub`;
      }
      a.download = fileName;

      a.click();
      URL.revokeObjectURL(url);

      alert(`漫画 EPUB 生成成功！共 ${pages.length} 页`);
    } catch (error) {
      console.error("生成漫画 EPUB 失败:", error);
      alert("生成失败：" + (error as Error).message);
    }
  }
}
