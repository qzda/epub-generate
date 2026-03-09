<script setup lang="ts">
  import { computed, ref, watch } from "vue";
  import { detectTextFileEncoding, EncodingList } from "./utils/text";
  import { readFileLinesWithEncoding } from "./utils/file";
  import { generateEpub } from "./utils/epub";

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
  const bookType = ref<"book" | "comic">("book");
  const bookName = ref<string>("");
  const bookAuthor = ref<string>("未知作者");
  const encoding = ref<string>();

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
      console.log("上传文件", _file.name);

      file.value = _file;
      bookName.value = _file.name.replace(/\.[^/.]+$/, "");

      if (_file.name.toLowerCase().endsWith(".txt")) {
        bookType.value = "book";

        // 自动检测编码
        const detectedEncoding = await detectTextFileEncoding(_file);
        if (detectedEncoding) {
          encoding.value = detectedEncoding;
          console.log("检测到的编码:", detectedEncoding);

          // 使用检测到的编码读取文件
          await loadFilePreview(_file, detectedEncoding);

          setTimeout(() => {
            regexText.value = "第*章";
          }, 200);
        }
      }

      if (_file.name.toLowerCase().endsWith(".zip")) {
        bookType.value = "comic";
      }
    } else {
      console.error("onFileChange", _file);
    }
  }

  async function onEncodingChange() {
    if (file.value && encoding.value) {
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

  async function generateEpubHandle() {
    if (isGenerating.value || !file.value) {
      return;
    }

    isGenerating.value = true;

    if (bookType.value === "book") {
      if (!regexText.value || !encoding.value) {
        return;
      }

      generateEpub(file.value, bookName.value, {
        type: "book",
        name: bookAuthor.value,
        author: bookAuthor.value,
        option: {
          regex: regexText.value,
          encoding: encoding.value,
        },
      }).finally(() => {
        isGenerating.value = false;
      });
    }

    if (bookType.value === "comic") {
      generateEpub(file.value, bookName.value, {
        type: "comic",
        name: bookAuthor.value,
        author: bookAuthor.value,
      }).finally(() => {
        isGenerating.value = false;
      });
    }
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
        <i class="i-carbon:upload" /> 上传
      </label>

      <input
        class="hidden"
        type="file"
        id="uploadTextFile"
        accept="text/*,.zip"
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
          for="bookName"
        >
          书名
        </label>
        <input
          v-model="bookName"
          class="w-full px-3 py-2 border-base focus:outline-none focus:border-blue-500"
          type="text"
          id="bookName"
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

      <div v-if="bookType === 'book'">
        <label
          class="block text-sm font-medium mb-2"
          for="encoding"
        >
          文本编码
        </label>
        <select
          v-model="encoding"
          @change="onEncodingChange"
          class="w-full px-3 py-2 border-base focus:outline-none focus:border-blue-500 dark:bg-[--background] cursor-pointer"
          id="encoding"
        >
          <option
            v-for="encoding in EncodingList"
            :value="encoding"
          >
            {{ encoding }}
          </option>
        </select>
        <div class="text-xs text-gray-500 mt-1">自动检测: {{ encoding }}</div>
      </div>
    </div>

    <!-- 正则表达式 -->
    <div v-if="bookType === 'book'">
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
      <div v-if="bookType === 'book'">
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
      <div v-if="bookType === 'book'">
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

      <div v-if="bookType === 'comic'">
        <h2>comic preview</h2>
      </div>
    </div>

    <!-- 生成按钮 -->
    <div class="flex justify-center pt-4">
      <button
        @click="generateEpubHandle"
        :disabled="isGenerating"
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
    <p>请上传任意文本文件或压缩包</p>
  </div>

  <footer class="text-center mt-4">
    2025-PRESENT &copy;
    <a
      href="https://github.com/qzda/epub-generate"
      target="_blank"
      class="underline"
    >
      qzda<i class="i-carbon:logo-github" />
    </a>
  </footer>
</template>
