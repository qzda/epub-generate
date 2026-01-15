<script setup lang="ts">
  import { computed, ref, watch } from "vue";
  import JSZip from "jszip";

  interface Chapter {
    title: string;
    content: string[];
  }

  const file = ref<File>();
  const lines = ref<string[]>();
  const fileAsyncGenerator = ref<AsyncGenerator<string, void, void>>();
  const regexText = ref<string>();
  const regex = computed(() => {
    if (regexText.value) {
      try {
        return new RegExp(regexText.value);
      } catch (error) {
        return undefined;
      }
    }
    return undefined;
  });

  const matchedChapters = ref<{ index: number; title: string }[]>([]);
  const isGenerating = ref(false);
  const bookTitle = ref<string>("");
  const bookAuthor = ref<string>("未知作者");
  const encoding = ref<string>("auto");

  // 检测文件编码
  async function detectEncoding(file: File): Promise<string> {
    const bytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer());

    // 检测 UTF-8 BOM
    if (
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
    ) {
      return "utf-8";
    }

    // 检测 UTF-16 LE BOM
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return "utf-16le";
    }

    // 检测 UTF-16 BE BOM
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return "utf-16be";
    }

    // 简单的 GB2312/GBK 检测（检测中文字符范围）
    let gbkLikeCount = 0;
    let asciiCount = 0;

    for (let i = 0; i < Math.min(bytes.length - 1, 1000); i++) {
      if (bytes[i] < 0x80) {
        asciiCount++;
      } else if (
        bytes[i] >= 0x81 &&
        bytes[i] <= 0xfe &&
        bytes[i + 1] >= 0x40 &&
        bytes[i + 1] <= 0xfe
      ) {
        gbkLikeCount++;
        i++; // 跳过下一个字节
      }
    }

    // 如果有明显的 GBK 特征，返回 gbk
    if (gbkLikeCount > 5 && gbkLikeCount > asciiCount * 0.1) {
      return "gbk";
    }

    return "utf-8";
  }

  // 使用指定编码读取文件
  async function* readFileLinesWithEncoding(
    file: File,
    encoding: string
  ): AsyncGenerator<string> {
    const decoder = new TextDecoder(encoding);
    const chunkSize = 64 * 1024; // 64KB
    let buffer = "";
    let offset = 0;

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      const arrayBuffer = await chunk.arrayBuffer();
      const decoded = decoder.decode(arrayBuffer, { stream: true });
      buffer += decoded;

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        yield line.replace(/\r$/, "");
      }

      offset += chunkSize;
    }

    if (buffer) {
      const lines = buffer.split("\n");
      for (const line of lines) {
        yield line.replace(/\r$/, "");
      }
    }
  }

  watch([lines, regex], ([_lines, _regex]) => {
    matchedChapters.value = [];
    if (_regex && _lines?.length) {
      _lines.forEach((_line, index) => {
        const match = _line.match(_regex);
        if (match) {
          matchedChapters.value.push({
            index,
            title: _line.trim(),
          });
        }
      });
    }
  });

  async function onFileChange(e: Event) {
    const _file = (e.target as HTMLInputElement).files?.item(0);

    if (_file && _file.size < 50 * 1048576) {
      file.value = _file;
      bookTitle.value = _file.name.replace(/\.[^/.]+$/, "");

      // 自动检测编码
      const detectedEncoding = await detectEncoding(_file);
      encoding.value = detectedEncoding;
      console.log("检测到的编码:", detectedEncoding);

      // 使用检测到的编码读取文件
      await loadFilePreview(_file, detectedEncoding);

      setTimeout(() => {
        regexText.value = "第*章";
      }, 200);
    }
  }

  async function onEncodingChange() {
    if (file.value) {
      await loadFilePreview(file.value, encoding.value);
    }
  }

  async function loadFilePreview(file: File, enc: string) {
    fileAsyncGenerator.value = readFileLinesWithEncoding(file, enc);
    lines.value = [];

    let count = 0;
    for await (const line of fileAsyncGenerator.value) {
      if (count >= 200) {
        break;
      }

      lines.value.push(line);

      if (line.trim().length) {
        count++;
      }
    }
  }

  async function generateEpub() {
    if (!file.value || !regex.value) return;

    isGenerating.value = true;

    try {
      const chapters: Chapter[] = [];
      let currentChapter: Chapter | null = null;

      // 使用当前选择的编码重新创建文件读取器
      const fileReader = readFileLinesWithEncoding(file.value, encoding.value);

      for await (const line of fileReader) {
        const match = line.match(regex.value);

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
      const title = bookTitle.value || file.value.name;
      const author = bookAuthor.value;

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
              <dc:title>${escapeXml(title)}</dc:title>
              <dc:creator>${escapeXml(author)}</dc:creator>
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
          <docTitle><text>${escapeXml(title)}</text></docTitle>
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
      a.download = `${title}.epub`;
      a.click();
      URL.revokeObjectURL(url);

      alert(`EPUB 生成成功！共 ${chapters.length} 章`);
    } catch (error) {
      console.error("生成 EPUB 失败:", error);
      alert("生成失败：" + (error as Error).message);
    } finally {
      isGenerating.value = false;
    }
  }

  function escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
</script>

<template>
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold text-black dark:text-white">EPUB生成器</h1>
    <div class="text-sm">
      <label
        class="btn bg-blue-500 text-white hover:bg-blue-600 transition inline-flex items-center gap-2"
        for="uploadTextFile"
      >
        <i class="i-carbon:upload" />
        上传文本文件
      </label>

      <input
        class="hidden"
        type="file"
        id="uploadTextFile"
        accept="text/*,.txt"
        @change="onFileChange"
      />
    </div>
  </div>

  <div
    v-if="file"
    class="space-y-4"
  >
    <!-- 文件信息 -->
    <div class="p-4 bg-gray-100 dark:bg-gray-800 border-base">
      <div class="font-bold text-lg mb-2">{{ file.name }}</div>
      <div class="text-sm text-gray-600 dark:text-gray-400">
        文件大小: {{ (file.size / 1024).toFixed(2) }} KB
      </div>
    </div>

    <!-- 配置区域 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label
          class="block text-sm font-medium mb-2"
          for="bookTitle"
        >
          书名
        </label>
        <input
          v-model="bookTitle"
          class="w-full px-3 py-2 border-base focus:outline-none focus:border-blue-500"
          type="text"
          id="bookTitle"
          placeholder="请输入书名"
        />
      </div>

      <div>
        <label
          class="block text-sm font-medium mb-2"
          for="bookAuthor"
        >
          作者
        </label>
        <input
          v-model="bookAuthor"
          class="w-full px-3 py-2 border-base focus:outline-none focus:border-blue-500"
          type="text"
          id="bookAuthor"
          placeholder="请输入作者"
        />
      </div>

      <div>
        <label
          class="block text-sm font-medium mb-2"
          for="encoding"
        >
          文件编码
        </label>
        <select
          v-model="encoding"
          @change="onEncodingChange"
          class="w-full px-3 py-2 border-base focus:outline-none focus:border-blue-500 dark:bg-[--background] cursor-pointer"
          id="encoding"
        >
          <option value="utf-8">UTF-8</option>
          <option value="gbk">GBK/GB2312</option>
          <option value="big5">Big5 (繁体)</option>
          <option value="shift-jis">Shift-JIS (日文)</option>
          <option value="euc-kr">EUC-KR (韩文)</option>
          <option value="utf-16le">UTF-16 LE</option>
          <option value="utf-16be">UTF-16 BE</option>
        </select>
        <div class="text-xs text-gray-500 mt-1">自动检测: {{ encoding }}</div>
      </div>
    </div>

    <!-- 正则表达式 -->
    <div>
      <label
        class="block text-sm font-medium mb-2"
        for="regex"
      >
        章节识别正则表达式
      </label>
      <input
        v-model="regexText"
        class="w-full px-3 py-2 border-base focus:outline-none focus:border-blue-500 font-mono"
        type="text"
        id="regex"
        placeholder="例如: 第*章"
      />
      <div class="text-xs text-gray-500 mt-1">
        匹配到 {{ matchedChapters.length }} 个章节
      </div>
    </div>

    <!-- 预览区域 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 文本预览 -->
      <div>
        <h3 class="text-sm font-medium mb-2">文本预览（前200行）</h3>
        <div
          class="h-96 p-4 text-sm border-base overflow-auto bg-white dark:bg-gray-900"
        >
          <p
            v-for="(line, index) in lines"
            :key="index"
            :class="{
              'font-bold text-green-500': matchedChapters.some(
                (ch) => ch.index === index
              ),
            }"
          >
            {{ line || "\u00A0" }}
          </p>
        </div>
      </div>

      <!-- 章节列表 -->
      <div>
        <h3 class="text-sm font-medium mb-2">识别的章节</h3>
        <div
          class="h-96 p-4 text-sm border-base overflow-auto bg-white dark:bg-gray-900"
        >
          <div
            v-if="matchedChapters.length === 0"
            class="text-gray-400 text-center py-8"
          >
            未识别到章节
          </div>
          <div
            v-else
            v-for="(chapter, index) in matchedChapters"
            :key="index"
            class="py-2 border-b border-gray-200 dark:border-gray-700"
          >
            <span class="text-gray-500 mr-2">{{ index + 1 }}.</span>
            {{ chapter.title }}
          </div>
        </div>
      </div>
    </div>

    <!-- 生成按钮 -->
    <div class="flex justify-center pt-4">
      <button
        @click="generateEpub"
        :disabled="isGenerating || !regex || matchedChapters.length === 0"
        class="btn bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
      >
        <span v-if="isGenerating">生成中...</span>
        <span v-else>生成 EPUB</span>
      </button>
    </div>
  </div>

  <!-- 空状态 -->
  <div
    v-else
    class="text-center py-20 text-gray-400 flex-1 flex flex-col items-center justify-center"
  >
    <i class="i-carbon:document text-6xl mb-4" />
    <p>请上传文本文件</p>
  </div>

  <footer class="text-center mt-4">
    2026-PRESENT &copy;
    <a
      href="https://github.com/qzda/epub-generate"
      target="_blank"
      class="underline"
    >
      qzda<i class="i-carbon:logo-github" />
    </a>
  </footer>
</template>
