<script setup lang="ts">
  import JSZip from "jszip";
  import { computed, onBeforeUnmount, ref, watch } from "vue";
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
  const uploadInputRef = ref<HTMLInputElement>();
  const comicPreviewImages = ref<Array<{ name: string; url: string }>>([]);
  const isComicPreviewLoading = ref(false);
  const comicPreviewError = ref("");

  function openFilePicker() {
    uploadInputRef.value?.click();
  }

  function clearComicPreview() {
    comicPreviewImages.value.forEach((image) => URL.revokeObjectURL(image.url));
    comicPreviewImages.value = [];
    comicPreviewError.value = "";
  }

  function getBaseName(path: string): string {
    const normalized = path.replace(/\\/g, "/");
    return normalized.split("/").pop() || path;
  }

  async function loadComicPreview(file: File) {
    clearComicPreview();
    isComicPreviewLoading.value = true;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
      const imageFiles: Array<{ name: string; data: JSZip.JSZipObject }> = [];

      zip.forEach((relativePath, fileEntry) => {
        if (fileEntry.dir) return;
        const lower = relativePath.toLowerCase();
        if (imageExtensions.some((ext) => lower.endsWith(ext))) {
          imageFiles.push({ name: relativePath, data: fileEntry });
        }
      });

      const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: "base",
      });
      imageFiles.sort((a, b) => {
        const baseCompare = collator.compare(getBaseName(a.name), getBaseName(b.name));
        if (baseCompare !== 0) return baseCompare;
        return collator.compare(a.name, b.name);
      });

      const previewFiles = imageFiles.slice(0, 20);
      for (const previewFile of previewFiles) {
        const blob = await previewFile.data.async("blob");
        const url = URL.createObjectURL(blob);
        comicPreviewImages.value.push({
          name: getBaseName(previewFile.name),
          url,
        });
      }
    } catch (error) {
      comicPreviewError.value = "图片预览加载失败";
      console.error("加载漫画预览失败:", error);
    } finally {
      isComicPreviewLoading.value = false;
    }
  }

  onBeforeUnmount(() => {
    clearComicPreview();
  });

  function isTextLikeFile(_file: File): boolean {
    const name = _file.name.toLowerCase();
    if (name.endsWith(".zip")) {
      return false;
    }

    if (_file.type.startsWith("text/")) {
      return true;
    }

    const textExtensions = [".txt", ".md"];

    return textExtensions.some((ext) => name.endsWith(ext));
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
      console.log("上传文件", _file.name);

      file.value = _file;
      bookName.value = _file.name.replace(/\.[^/.]+$/, "");

      if (isTextLikeFile(_file)) {
        bookType.value = "book";
        clearComicPreview();

        // 自动检测编码
        const detectedEncoding = await detectTextFileEncoding(_file);
        encoding.value = detectedEncoding || "utf-8";
        console.log("检测到的编码:", detectedEncoding || "utf-8");

        // 使用检测到的编码读取文件
        await loadFilePreview(_file, encoding.value);

        setTimeout(() => {
          regexText.value = "第.+章";
        }, 200);
      }

      if (_file.name.toLowerCase().endsWith(".zip")) {
        bookType.value = "comic";
        await loadComicPreview(_file);
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

    if (bookType.value === "book" && (!regexText.value || !encoding.value)) {
      alert("请填写章节正则并选择文本编码");
      return;
    }

    isGenerating.value = true;

    try {
      if (bookType.value === "book") {
        await generateEpub(file.value, bookName.value, {
          type: "book",
          name: bookName.value,
          author: bookAuthor.value,
          option: {
            regex: regexText.value!,
            encoding: encoding.value!,
          },
        });
      }

      if (bookType.value === "comic") {
        await generateEpub(file.value, bookName.value, {
          type: "comic",
          name: bookName.value,
          author: bookAuthor.value,
        });
      }
    } finally {
      isGenerating.value = false;
    }
  }
</script>

<template>
  <div class="studio-shell rise-in pb-14">
    <header class="studio-hero">
      <div>
        <h1 class="m-0 text-[clamp(20px,3.4vw,30px)] leading-[1.05] tracking-[0.01em]">
          文本与图包，一键制书
        </h1>
        <p class="mt-1.5 mb-0 max-w-[54ch] text-[13px] text-studio-muted">
          支持 TXT/MD 自动分章，也支持 ZIP 图片集按文件名排序转漫画 EPUB。
        </p>
      </div>
      <div class="flex items-center gap-2 max-md:w-full">
        <button
          type="button"
          class="btn border-studio-line bg-[var(--panel-muted)] text-studio-text hover:bg-[var(--accent-soft)] max-md:flex-1 max-md:justify-center"
          @click="openFilePicker"
        >
          <i class="i-carbon:upload" />
          <span>上传文件</span>
        </button>
        <button
          @click="generateEpubHandle"
          :disabled="isGenerating || !file"
          :class="[
            'btn btn-primary !mt-0 max-md:flex-1 max-md:justify-center',
            isGenerating || !file ? 'btn-disable' : '',
          ]"
        >
          <i class="i-carbon:book" />
          <span v-if="isGenerating">生成中...</span>
          <span v-else>生成 EPUB</span>
        </button>
      </div>
      <input
        ref="uploadInputRef"
        class="hidden"
        type="file"
        id="uploadTextFile"
        accept="text/*,.md,.txt,.zip"
        @change="onFileChange"
      />
    </header>

    <section
      v-if="file"
      class="grid grid-cols-1 lg:grid-cols-[290px_1fr] gap-3.5 min-h-[520px]"
    >
      <aside
        class="grid content-start gap-3 border border-studio-line rounded-xl p-3.5 bg-[var(--panel)]"
      >
        <div class="border border-studio-line rounded-lg bg-[var(--panel-muted)] p-2.5">
          <p class="m-0 break-all font-700 text-[13px]/[1.4] font-mono">
            {{ file.name }}
          </p>
          <p class="mt-1.5 mb-0 text-xs text-studio-muted">
            {{ (file.size / 1024).toFixed(2) }} KB ·
            {{ bookType === "book" ? "文本模式" : "漫画模式" }}
          </p>
        </div>

        <div class="grid gap-1.5">
          <label
            for="bookName"
            class="studio-label"
          >
            书名
          </label>
          <input
            id="bookName"
            v-model="bookName"
            class="studio-input"
            type="text"
            placeholder="请输入书名"
          />
        </div>

        <div class="grid gap-1.5">
          <label
            for="bookAuthor"
            class="studio-label"
          >
            作者
          </label>
          <input
            id="bookAuthor"
            v-model="bookAuthor"
            class="studio-input"
            type="text"
            placeholder="请输入作者"
          />
        </div>

        <div
          v-if="bookType === 'book'"
          class="grid gap-1.5"
        >
          <label
            for="encoding"
            class="studio-label"
          >
            文本编码
          </label>
          <select
            id="encoding"
            v-model="encoding"
            @change="onEncodingChange"
            class="studio-input cursor-pointer"
          >
            <option
              v-for="encoding in EncodingList"
              :value="encoding"
            >
              {{ encoding }}
            </option>
          </select>
          <p class="studio-note">自动检测: {{ encoding }}</p>
        </div>

        <div
          v-if="bookType === 'book'"
          class="grid gap-1.5"
        >
          <label
            for="regex"
            class="studio-label"
          >
            章节正则
          </label>
          <input
            id="regex"
            v-model="regexText"
            class="studio-input"
            type="text"
            placeholder="例如: 第.+章"
          />
          <p class="studio-note">匹配到 {{ matchedChapters.length }} 个章节</p>
        </div>

      </aside>

      <main
        :class="
          bookType === 'book'
            ? 'grid grid-cols-1 md:grid-cols-2 gap-3.5 min-h-0'
            : 'grid grid-cols-1 gap-3.5 min-h-0'
        "
      >
        <template v-if="bookType === 'book'">
          <section class="studio-panel min-h-0 grid grid-rows-[auto_1fr]">
            <div class="studio-panel-head">
              <h3 class="m-0 text-sm font-700">文本预览</h3>
              <span class="text-xs text-studio-muted">前 200 行</span>
            </div>
            <div class="studio-panel-body">
              <p
                v-for="(line, index) in lines"
                :key="index"
                :class="
                  matchedChapters.some((ch) => ch.index === index)
                    ? 'm-0 whitespace-pre-wrap break-words font-mono text-[12.5px]/[1.6] text-studio-accent font-700'
                    : 'm-0 whitespace-pre-wrap break-words font-mono text-[12.5px]/[1.6]'
                "
              >
                {{ line || "\u00A0" }}
              </p>
            </div>
          </section>

          <section class="studio-panel min-h-0 grid grid-rows-[auto_1fr]">
            <div class="studio-panel-head">
              <h3 class="m-0 text-sm font-700">目录识别</h3>
              <span class="text-xs text-studio-muted">{{ matchedChapters.length }} 条</span>
            </div>
            <div class="studio-panel-body">
              <p
                v-if="matchedChapters.length === 0"
                class="m-[20px_auto] text-center text-sm text-studio-muted"
              >
                未识别到章节，将按短篇正文生成。
              </p>
              <p
                v-for="(chapter, index) in matchedChapters"
                v-else
                :key="index"
                class="m-0 border-b border-studio-line py-2 text-[13px] [&>span]:inline-block [&>span]:w-7 [&>span]:font-mono [&>span]:text-studio-accent"
              >
                <span>{{ index + 1 }}</span>
                {{ chapter.title }}
              </p>
            </div>
          </section>
        </template>

        <section
          v-else
          class="studio-panel min-h-0 grid grid-rows-[auto_1fr]"
        >
          <div class="studio-panel-head">
            <h3 class="m-0 text-sm font-700">漫画模式</h3>
            <span class="text-xs text-studio-muted">前 20 张预览</span>
          </div>
          <div class="studio-panel-body">
            <p
              v-if="isComicPreviewLoading"
              class="m-0 h-full grid place-items-center text-sm text-studio-muted"
            >
              正在加载图片预览...
            </p>
            <p
              v-else-if="comicPreviewError"
              class="m-0 h-full grid place-items-center text-sm text-red-500"
            >
              {{ comicPreviewError }}
            </p>
            <p
              v-else-if="comicPreviewImages.length === 0"
              class="m-0 h-full grid place-items-center text-sm text-studio-muted"
            >
              压缩包中未找到可预览的图片
            </p>
            <div
              v-else
              class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2"
            >
              <figure
                v-for="(image, index) in comicPreviewImages"
                :key="`${image.name}-${index}`"
                class="m-0 border border-studio-line rounded-lg bg-[var(--panel-muted)] overflow-hidden"
              >
                <img
                  :src="image.url"
                  :alt="image.name"
                  class="w-full h-40 object-cover block"
                />
                <figcaption class="px-2 py-1 text-[11px] text-studio-muted truncate">
                  {{ image.name }}
                </figcaption>
              </figure>
            </div>
          </div>
        </section>
      </main>
    </section>

    <section
      v-else
      class="studio-empty-shell"
    >
      <i class="i-carbon:document text-[56px] m-[0_auto_6px] text-studio-accent" />
      <h2 class="m-0 text-studio-text text-[22px]">把文稿或图包拖进来</h2>
      <p class="m-0 text-sm">TXT/MD 支持正则分章，ZIP 图片包自动排页。</p>
    </section>

    <footer
      class="fixed bottom-0 left-0 right-0 h-12 flex items-center justify-center text-xs text-studio-muted bg-[var(--background)]/85 backdrop-blur-sm"
    >
      2025-PRESENT &copy;
      <a
        href="https://github.com/qzda/epub-generate"
        target="_blank"
        class="text-studio-accent no-underline"
      >
        qzda <i class="i-carbon:logo-github" />
      </a>
    </footer>
  </div>
</template>

<style scoped>
  .rise-in {
    animation: rise 420ms ease-out;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
