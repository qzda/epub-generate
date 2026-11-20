<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, shallowRef } from "vue";
  import { useDropZone, useFileDialog } from "@vueuse/core";
  import AppNotice from "./components/AppNotice.vue";
  import BookMetaForm from "./components/BookMetaForm.vue";
  import ComicWorkspace from "./components/ComicWorkspace.vue";
  import ExportBar from "./components/ExportBar.vue";
  import SourceDropzone from "./components/SourceDropzone.vue";
  import TextSettings from "./components/TextSettings.vue";
  import TextWorkspace from "./components/TextWorkspace.vue";
  import { useComicSource } from "./composables/useComicSource";
  import { useExport } from "./composables/useExport";
  import { useMessages } from "./composables/useMessages";
  import { useTextSource } from "./composables/useTextSource";
  import { createBookMeta, sanitizeEpubFileName } from "./domain/book";
  import { compileChapterPattern } from "./domain/chapter";
  import { DEFAULT_ENCODING } from "./domain/encoding";
  import type { TextEncoding } from "./domain/encoding";
  import { buildComicEpub } from "./domain/epub/build-comic";
  import { buildTextEpub } from "./domain/epub/build-text";
  import { DomainError } from "./domain/result";
  import { MAX_SOURCE_FILE_SIZE } from "./config/limits";
  import { isAbortError } from "./services/abort";
  import { downloadBlob } from "./services/download";
  import { detectTextEncoding } from "./services/encoding-detect";
  import { packEpub } from "./services/epub-pack";
  import { readTextChapters } from "./services/text-source";

  const DEFAULT_PATTERN =
    "^\\s*第[0-9一二三四五六七八九十百千万]+章(?:\\s|$)";
  const MAX_FILE_LABEL = "50 MB";

  const file = shallowRef<File>();
  const mode = ref<"text" | "comic">("text");
  const bookTitle = ref("");
  const bookAuthor = ref("未知作者");
  const encoding = ref<TextEncoding>(DEFAULT_ENCODING);
  const pattern = ref(DEFAULT_PATTERN);
  const detectedEncoding = ref<string | null>(null);
  const encodingFallback = ref(false);
  const isEncodingDetecting = ref(false);

  const textFile = computed(() =>
    mode.value === "text" ? file.value : undefined
  );
  const comicFile = computed(() =>
    mode.value === "comic" ? file.value : undefined
  );

  const {
    previewLines,
    chapterRefs,
    totalLines,
    matchedCount,
    isScanning,
    error: textError,
  } = useTextSource(textFile, encoding, pattern);

  const {
    previews: comicPreviews,
    images: comicImages,
    totalImages,
    isLoading: isComicLoading,
    error: comicError,
  } = useComicSource(comicFile);

  const {
    isGenerating,
    progress,
    stage,
    error: exportError,
    run,
  } = useExport();

  const { notices, push, dismiss, clear: clearMessages } = useMessages();

  const dropZoneRef = ref<HTMLElement | null>(null);

  const { isOverDropZone } = useDropZone(dropZoneRef, {
    multiple: false,
    onDrop(files) {
      const selected = files?.[0];
      if (selected) {
        void selectFile(selected);
      }
    },
  });

  const {
    open: openFilePicker,
    reset: resetFilePicker,
    onChange: onFileDialogChange,
  } = useFileDialog({
    accept: "text/*,.md,.txt,.zip",
    multiple: false,
    reset: true,
  });

  onFileDialogChange((files) => {
    const selected = files?.item(0);
    if (selected) {
      void selectFile(selected);
    }
  });

  let selectionToken = 0;
  let detectController: AbortController | null = null;

  const canExport = computed(() => {
    if (!file.value || isGenerating.value || isEncodingDetecting.value) {
      return false;
    }

    if (mode.value === "text") {
      return (
        !isScanning.value && !textError.value && totalLines.value > 0
      );
    }

    return (
      !isComicLoading.value &&
      !comicError.value &&
      totalImages.value > 0
    );
  });

  function isZipFile(candidate: File): boolean {
    return candidate.name.toLowerCase().endsWith(".zip");
  }

  function isTextLikeFile(candidate: File): boolean {
    if (isZipFile(candidate)) {
      return false;
    }

    if (candidate.type.startsWith("text/")) {
      return true;
    }

    const name = candidate.name.toLowerCase();
    return name.endsWith(".txt") || name.endsWith(".md");
  }

  function fileTitle(candidate: File): string {
    return candidate.name.replace(/\.[^/.]+$/, "").trim();
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function errorText(cause: unknown, fallback: string): string {
    return cause instanceof Error && cause.message
      ? cause.message
      : fallback;
  }

  async function selectFile(candidate: File): Promise<void> {
    if (isGenerating.value) {
      push("warning", "正在生成 EPUB，请稍后再切换文件。");
      return;
    }

    if (candidate.size > MAX_SOURCE_FILE_SIZE) {
      push(
        "error",
        `文件超过 ${MAX_FILE_LABEL} 限制，请压缩后再试。`
      );
      return;
    }

    const isZip = isZipFile(candidate);
    if (!isZip && !isTextLikeFile(candidate)) {
      push("error", "仅支持 TXT/MD 文本或 ZIP 图片压缩包。");
      return;
    }

    clearMessages();
    selectionToken += 1;
    const currentToken = selectionToken;
    detectController?.abort();
    detectController = null;

    file.value = candidate;
    mode.value = isZip ? "comic" : "text";
    bookTitle.value = fileTitle(candidate);
    detectedEncoding.value = null;
    encodingFallback.value = false;
    isEncodingDetecting.value = !isZip;

    if (isZip) {
      pattern.value = DEFAULT_PATTERN;
      push("info", `已载入 ${candidate.name}，正在读取图片包。`);
      return;
    }

    encoding.value = DEFAULT_ENCODING;
    pattern.value = DEFAULT_PATTERN;

    const controller = new AbortController();
    detectController = controller;

    try {
      const detection = await detectTextEncoding(candidate, {
        signal: controller.signal,
      });

      if (currentToken !== selectionToken) {
        return;
      }

      encoding.value = detection.encoding;
      detectedEncoding.value = detection.detected;
      encodingFallback.value = detection.fallback;

      if (detection.fallback) {
        push(
          "warning",
          `未能可靠识别文本编码，已回退 ${detection.encoding}。`
        );
      }

      push("info", `已载入 ${candidate.name}，正在扫描全文。`);
    } catch (cause) {
      if (currentToken === selectionToken && !isAbortError(cause)) {
        push("error", errorText(cause, "文本编码检测失败。"));
      }
    } finally {
      if (currentToken === selectionToken) {
        isEncodingDetecting.value = false;
      }
    }
  }

  function pickFile(): void {
    if (isGenerating.value) {
      return;
    }
    resetFilePicker();
    openFilePicker();
  }

  function createIdentifier(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function createModifiedAt(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  async function exportEpub(): Promise<void> {
    const currentFile = file.value;
    if (!currentFile || isGenerating.value) {
      return;
    }

    if (mode.value === "text") {
      if (!pattern.value.trim()) {
        push("error", "请填写章节正则。");
        return;
      }
      if (isScanning.value) {
        push("warning", "正在扫描文本，请稍候再生成。");
        return;
      }
      if (textError.value) {
        push("error", textError.value.message);
        return;
      }
    } else {
      if (isComicLoading.value) {
        push("warning", "正在读取图片包，请稍候再生成。");
        return;
      }
      if (comicError.value) {
        push("error", comicError.value.message);
        return;
      }
    }

    const currentMode = mode.value;
    const currentEncoding = encoding.value;
    const currentPattern = pattern.value;
    const currentImages = comicImages.value;
    const expectedTotalLines = Math.max(1, totalLines.value);
    const meta = createBookMeta({
      title: bookTitle.value,
      author: bookAuthor.value,
    });
    const fileName = sanitizeEpubFileName(bookTitle.value || meta.title);
    const identifier = createIdentifier();
    const modifiedAt = createModifiedAt();

    const summary = await run(async (report, signal) => {
      if (currentMode === "text") {
        const compiled = compileChapterPattern(currentPattern);
        if (!compiled.ok) {
          throw new DomainError(compiled.error.code, compiled.error.message);
        }

        report("reading", 0.05);
        const chapters = await readTextChapters(
          currentFile,
          currentEncoding,
          compiled.value,
          {
            signal,
            onProgress: (processed) => {
              const readRatio = Math.min(
                1,
                processed / expectedTotalLines
              );
              report("reading", 0.05 + readRatio * 0.5);
            },
          }
        );
        report("building", 0.6);

        const entries = buildTextEpub({
          meta,
          identifier,
          modifiedAt,
          chapters,
        });
        report("packing", 0.7);

        const blob = await packEpub(entries, {
          signal,
          onProgress: (ratio) => report("packing", 0.7 + ratio * 0.25),
        });

        report("done", 1);
        downloadBlob(blob, fileName);
        return `文本 EPUB 生成成功，共 ${chapters.length} 章。`;
      }

      if (currentImages.length === 0) {
        throw new DomainError("NO_IMAGES", "ZIP 中没有可用的图片。");
      }

      report("building", 0.5);
      const entries = buildComicEpub({
        meta,
        identifier,
        modifiedAt,
        images: currentImages,
      });
      report("packing", 0.7);

      const blob = await packEpub(entries, {
        signal,
        onProgress: (ratio) => report("packing", 0.7 + ratio * 0.25),
      });

      report("done", 1);
      downloadBlob(blob, fileName);
      return `漫画 EPUB 生成成功，共 ${currentImages.length} 页。`;
    });

    if (summary) {
      push("success", summary);
    } else if (exportError.value) {
      push("error", exportError.value.message);
    }
  }

  onBeforeUnmount(() => {
    selectionToken += 1;
    detectController?.abort();
  });
</script>

<template>
  <div
    ref="dropZoneRef"
    class="studio-page rise-in"
    :class="
      isOverDropZone
        ? 'outline-2 outline-dashed outline-studio-accent outline-offset-[-10px]'
        : ''
    "
  >
    <div class="page-inner">
      <div class="topline">
        <div class="brand">
          <span class="brand-mark">E</span>
          <div class="brand-copy">
            Epub Generate
            <span>text &amp; comic → epub</span>
          </div>
        </div>
        <div class="status">
          <i />
          本地处理 · 文件不会上传
        </div>
      </div>

      <header class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Text &amp; Comic to EPUB</p>
          <h1>把文字，做成一本电子书。</h1>
          <p class="hero-description">
            拖入 TXT/MD 自动分章，或导入 ZIP 图片包按自然序排页。所有内容只在浏览器本地处理。
          </p>
        </div>
        <div class="hero-actions">
          <button
            type="button"
            class="btn"
            :disabled="isGenerating"
            :class="isGenerating ? 'btn-disable' : ''"
            @click="pickFile"
          >
            <i class="i-carbon:upload" />
            <span>上传文件</span>
          </button>
          <ExportBar
            :disabled="!canExport"
            :is-generating="isGenerating"
            :progress="progress"
            :stage="stage"
            @export="exportEpub"
          />
        </div>
      </header>

      <AppNotice
        :notices="notices"
        @dismiss="dismiss"
      />

      <Transition name="drop-fade">
        <div
          v-if="file && isOverDropZone"
          class="drop-overlay"
          aria-hidden="true"
        >
          <div class="drop-overlay-card">
            <span class="drop-overlay-icon">
              <i class="i-carbon:download text-[26px]" />
            </span>
            <strong>松开鼠标导入新文件</strong>
            <span>当前文件与设置会被替换</span>
          </div>
        </div>
      </Transition>

      <section
        v-if="file"
        class="workspace"
      >
        <aside class="settings-card studio-panel">
          <div class="file-chip">
            <div class="file-icon">
              <i class="i-carbon:document text-[18px]" />
            </div>
            <div class="min-w-0">
              <b>{{ file.name }}</b>
              <span>
                {{ formatFileSize(file.size) }} ·
                {{ mode === "text" ? "文本模式" : "漫画模式" }}
              </span>
            </div>
          </div>

          <p class="section-title">书籍信息</p>
          <BookMetaForm
            v-model:title="bookTitle"
            v-model:author="bookAuthor"
          />

          <template v-if="mode === 'text'">
            <p class="section-title">文本设置</p>
            <TextSettings
              v-model:encoding="encoding"
              v-model:pattern="pattern"
              :chapter-count="matchedCount"
              :total-lines="totalLines"
              :is-scanning="isScanning"
              :is-detecting-encoding="isEncodingDetecting"
              :encoding-fallback="encodingFallback"
              :detected-encoding="detectedEncoding"
              :error="textError"
            />
          </template>
          <p
            v-else
            class="studio-note mt-5"
          >
            ZIP 中的图片会按文件名自然序排列，一张图片一页。
          </p>
        </aside>

        <main class="min-w-0">
          <TextWorkspace
            v-if="mode === 'text'"
            :preview-lines="previewLines"
            :chapters="chapterRefs"
            :total-lines="totalLines"
            :is-scanning="isScanning"
            :error="textError"
            :book-title="bookTitle"
            :book-author="bookAuthor"
          />
          <ComicWorkspace
            v-else
            :previews="comicPreviews"
            :total-images="totalImages"
            :is-loading="isComicLoading"
            :error="comicError"
          />
        </main>
      </section>

      <SourceDropzone
        v-else
        class="mt-5"
        :active="isOverDropZone"
        :disabled="isGenerating"
        @pick="pickFile"
      />

      <footer class="page-footer">
        <span>本地优先 · 无上传 · 无遥测</span>
        <span>
          2025-PRESENT ©
          <a
            href="https://github.com/qzda/epub-generate"
            target="_blank"
            rel="noopener noreferrer"
          >
            qzda
          </a>
        </span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
  .studio-page {
    min-height: 100dvh;
    padding: 78px 30px 28px;
    color: var(--foreground);
    background:
      radial-gradient(900px 500px at 85% -10%, rgba(125, 166, 255, 0.22), transparent 60%),
      radial-gradient(700px 400px at 0% 10%, rgba(186, 214, 255, 0.32), transparent 55%),
      var(--background);
  }

  .page-inner {
    max-width: 1400px;
    margin: 0 auto;
  }

  .topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 14px;
    padding: 0 2px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: linear-gradient(135deg, #3b76ff, #2148c9);
    color: #fff;
    font-size: 13px;
    font-weight: 800;
    box-shadow: 0 8px 18px -8px rgba(47, 99, 233, 0.8);
  }

  .brand-copy {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .brand-copy span {
    display: block;
    margin-top: 1px;
    color: var(--muted);
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 12px;
  }

  .status i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.14);
  }

  .hero {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 30px;
    overflow: hidden;
    padding: 28px 32px;
    border: 1px solid rgba(214, 225, 242, 0.9);
    border-radius: 24px;
    background: linear-gradient(
      120deg,
      rgba(255, 255, 255, 0.96),
      rgba(241, 246, 255, 0.92)
    );
    box-shadow: 0 30px 70px -55px rgba(21, 34, 56, 0.55);
  }

  .hero::after {
    content: "";
    position: absolute;
    top: -96px;
    right: 170px;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(100, 145, 255, 0.22), transparent 65%);
    pointer-events: none;
  }

  .hero-copy {
    position: relative;
    z-index: 1;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: var(--accent);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .hero h1 {
    margin: 0;
    font-size: clamp(28px, 3vw, 38px);
    line-height: 1.15;
    letter-spacing: -0.02em;
  }

  .hero-description {
    max-width: 55ch;
    margin: 10px 0 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.7;
  }

  .hero-actions {
    position: relative;
    z-index: 1;
    display: flex;
    flex: 0 0 auto;
    gap: 10px;
  }

  .workspace {
    display: grid;
    grid-template-columns: 340px minmax(0, 1fr);
    align-items: start;
    gap: 20px;
    margin-top: 20px;
  }

  .settings-card {
    padding: 20px;
  }

  .file-chip {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 14px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: linear-gradient(180deg, #f8fbff, #f3f7ff);
  }

  .file-icon {
    display: grid;
    flex: 0 0 38px;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 11px;
    background: var(--accent-soft);
    color: var(--accent);
  }

  .file-chip b {
    display: block;
    overflow-wrap: anywhere;
    font-size: 13px;
  }

  .file-chip span {
    display: block;
    margin-top: 3px;
    color: var(--muted);
    font-size: 11px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 22px 0 12px;
    color: #8b9ab2;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .section-title::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .page-footer {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 18px;
    padding: 0 4px;
    color: var(--muted);
    font-size: 11px;
  }

  .page-footer a {
    color: var(--accent);
    text-decoration: none;
  }

  .page-footer a:hover {
    text-decoration: underline;
  }

  .drop-overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(15, 23, 42, 0.18);
    backdrop-filter: blur(2px);
    pointer-events: none;
  }

  .drop-overlay-card {
    display: grid;
    justify-items: center;
    gap: 6px;
    min-width: 260px;
    padding: 28px 36px;
    border: 2px dashed var(--accent);
    border-radius: 24px;
    background: var(--panel);
    box-shadow: 0 30px 70px -35px rgba(21, 34, 56, 0.55);
    text-align: center;
  }

  .drop-overlay-icon {
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    margin-bottom: 4px;
    border-radius: 16px;
    background: var(--accent-soft);
    color: var(--accent);
  }

  .drop-overlay-card strong {
    color: var(--foreground);
    font-size: 16px;
  }

  .drop-overlay-card > span:last-child {
    color: var(--muted);
    font-size: 12px;
  }

  .drop-fade-enter-active,
  .drop-fade-leave-active {
    transition: opacity 150ms ease;
  }

  .drop-fade-enter-from,
  .drop-fade-leave-to {
    opacity: 0;
  }

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

  @media (prefers-color-scheme: dark) {
    .studio-page {
      background:
        radial-gradient(900px 500px at 85% -10%, rgba(96, 140, 255, 0.14), transparent 60%),
        radial-gradient(700px 400px at 0% 10%, rgba(60, 90, 160, 0.16), transparent 55%),
        var(--background);
    }

    .hero {
      border-color: var(--border);
      background: linear-gradient(
        120deg,
        rgba(19, 29, 46, 0.96),
        rgba(15, 23, 37, 0.92)
      );
      box-shadow: 0 30px 70px -55px rgba(0, 0, 0, 0.8);
    }

    .hero::after {
      background: radial-gradient(circle, rgba(96, 140, 255, 0.18), transparent 65%);
    }

    .file-chip {
      background: linear-gradient(180deg, var(--panel-muted), var(--panel));
    }

    .section-title {
      color: var(--muted);
    }

    .drop-overlay {
      background: rgba(0, 0, 0, 0.42);
    }
  }

  @media (max-width: 480px) {
    .hero h1 {
      font-size: 24px;
    }

    .hero-description {
      font-size: 12px;
    }
  }

  @media (max-width: 960px) {
    .studio-page {
      padding: 74px 18px 24px;
    }

    .status {
      display: none;
    }

    .hero {
      flex-direction: column;
      align-items: flex-start;
      padding: 24px;
    }

    .hero-actions {
      width: 100%;
    }

    .hero-actions > :first-child {
      flex: 1;
    }

    .workspace {
      grid-template-columns: 1fr;
    }

    .settings-card {
      padding: 18px;
    }
  }
</style>
