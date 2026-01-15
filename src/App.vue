<script setup lang="ts">
  import { computed, ref, watch } from "vue";
  import { readFileLines } from "./utils";
  import epub from "epub-gen-memory";

  interface Chapter {
    title: string;
    content: string[];
  }

  const file = ref<File>();
  const lines = ref<string[]>();
  const fileAsyncGenerator = ref<ReturnType<typeof readFileLines>>();
  const regexText = ref<string>("^第.+章");
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
      if (count >= 20) {
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

      // 生成 EPUB
      const epubContent = chapters.map((ch) => ({
        title: ch.title,
        data: `<div style="text-indent: 2em; line-height: 1.8;">${ch.content
          .map((line) => `<p>${escapeHtml(line)}</p>`)
          .join("")}</div>`,
      }));

      const options = {
        title: bookTitle.value || file.value.name,
        author: bookAuthor.value,
        publisher: "EPUB Generator",
        content: epubContent,
        css: `
        body { font-family: "Noto Serif SC", serif; }
        p { margin: 0.5em 0; }
      `,
      };

      // epub-gen-memory 直接作为函数调用，返回 Promise<Blob>
      const blob = await epub(options);

      // 下载文件
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bookTitle.value || file.value.name}.epub`;
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

  function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
</script>

<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-black dark:text-white">EPUB 生成器</h1>
      <div>
        <label
          class="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600 transition inline-flex items-center gap-2"
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
      <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded">
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
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
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
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
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
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
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
          class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 font-mono"
          type="text"
          id="regex"
          placeholder="例如: ^第.+章"
        />
        <div class="text-xs text-gray-500 mt-1">
          匹配到 {{ matchedChapters.length }} 个章节
        </div>
      </div>

      <!-- 预览区域 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- 文本预览 -->
        <div>
          <h3 class="text-sm font-medium mb-2">文本预览（前20行）</h3>
          <div
            class="h-96 p-4 text-sm border border-gray-300 border-dashed rounded overflow-auto bg-white dark:bg-gray-900"
          >
            <p
              v-for="(line, index) in lines"
              :key="index"
              :class="{
                'font-bold text-blue-600': matchedChapters.some(
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
            class="h-96 p-4 text-sm border border-gray-300 rounded overflow-auto bg-white dark:bg-gray-900"
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
          class="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
        >
          <span v-if="isGenerating">生成中...</span>
          <span v-else>生成 EPUB</span>
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else
      class="text-center py-20 text-gray-400"
    >
      <i class="i-carbon:document text-6xl mb-4" />
      <p>请上传文本文件开始</p>
    </div>
  </div>
</template>
