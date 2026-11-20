<script setup lang="ts">
  import { computed, ref } from "vue";
  import { PREAMBLE_TITLE } from "../domain/chapter";
  import type { ChapterRef } from "../domain/chapter";
  import type { AppError } from "../domain/result";

  const props = defineProps<{
    previewLines: string[];
    chapters: ChapterRef[];
    totalLines: number;
    isScanning: boolean;
    error?: AppError | null;
    bookTitle: string;
    bookAuthor: string;
  }>();

  const activeView = ref<"preview" | "toc">("preview");

  const chapterStartLines = computed(
    () =>
      new Set(
        props.chapters
          .filter((chapter) => chapter.title !== PREAMBLE_TITLE)
          .map((chapter) => chapter.startLine)
      )
  );
</script>

<template>
  <section class="studio-panel main-card">
    <div class="main-head">
      <div>
        <h2>正文预览</h2>
        <p>前 {{ previewLines.length }} 行 / 共 {{ totalLines }} 行</p>
      </div>
      <div class="segmented">
        <button
          type="button"
          :class="activeView === 'preview' ? 'active' : ''"
          @click="activeView = 'preview'"
        >
          预览
        </button>
        <button
          type="button"
          :class="activeView === 'toc' ? 'active' : ''"
          @click="activeView = 'toc'"
        >
          目录 {{ chapters.length }}
        </button>
      </div>
    </div>

    <div
      v-if="chapters.length > 0"
      class="toc-strip"
    >
      <button
        v-for="(chapter, index) in chapters"
        :key="`${chapter.startLine}-${index}`"
        type="button"
        @click="activeView = 'toc'"
      >
        <b>{{ String(index + 1).padStart(2, "0") }}</b>
        {{ chapter.title }}
      </button>
    </div>

    <div class="preview-body">
      <p
        v-if="isScanning && previewLines.length === 0"
        class="empty-state"
      >
        正在扫描文本…
      </p>
      <p
        v-else-if="error"
        class="empty-state error"
        role="status"
      >
        文本暂时无法识别，请检查左侧设置。
      </p>

      <template v-else-if="activeView === 'preview'">
        <p
          v-if="previewLines.length === 0"
          class="empty-state"
        >
          暂无预览内容
        </p>
        <template v-else>
          <h3 class="book-title">{{ bookTitle || "未命名书籍" }}</h3>
          <p class="book-meta">
            {{ bookAuthor || "未知作者" }} · {{ chapters.length }} 篇 · EPUB 3
          </p>
          <p
            v-for="(line, index) in previewLines"
            :key="index"
            :class="[
              'line',
              chapterStartLines.has(index) ? 'line-heading' : '',
              line.trim() ? '' : 'line-blank',
            ]"
          >
            {{ line || "\u00A0" }}
          </p>
        </template>
      </template>

      <template v-else>
        <p
          v-if="chapters.length === 0"
          class="empty-state"
        >
          未识别到章节，将按短篇正文生成。
        </p>
        <ol
          v-else
          class="toc-list"
        >
          <li
            v-for="(chapter, index) in chapters"
            :key="`${chapter.startLine}-${index}`"
          >
            <span>{{ String(index + 1).padStart(2, "0") }}</span>
            <div>
              <b>{{ chapter.title }}</b>
              <small>从第 {{ chapter.startLine + 1 }} 行开始</small>
            </div>
          </li>
        </ol>
      </template>
    </div>
  </section>
</template>

<style scoped>
  .main-card {
    display: grid;
    grid-template-rows: auto auto 1fr;
    min-height: 700px;
  }

  .main-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 17px 20px 13px;
  }

  .main-head h2 {
    margin: 0;
    font-size: 14px;
  }

  .main-head p {
    margin: 5px 0 0;
    color: var(--muted);
    font-size: 11px;
  }

  .segmented {
    display: inline-flex;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #f6f9ff;
  }

  .segmented button {
    padding: 6px 12px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .segmented button.active {
    background: #fff;
    color: var(--accent);
    box-shadow: 0 4px 12px -8px rgba(21, 34, 56, 0.5);
  }

  .toc-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 0 20px 14px;
    scrollbar-width: none;
  }

  .toc-strip::-webkit-scrollbar {
    display: none;
  }

  .toc-strip button {
    flex: 0 0 auto;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: #fbfdff;
    color: #52637c;
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }

  .toc-strip button:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .toc-strip b {
    margin-right: 4px;
    color: var(--accent);
    font-family: "SFMono-Regular", Menlo, monospace;
    font-size: 10px;
  }

  .preview-body {
    overflow: auto;
    padding: 8px 26px 28px;
    border-top: 1px solid var(--border);
    background:
      linear-gradient(
        90deg,
        rgba(47, 99, 233, 0.035) 0,
        transparent 12%,
        transparent 88%,
        rgba(47, 99, 233, 0.035) 100%
      ),
      #fff;
  }

  .book-title {
    margin: 24px 0 4px;
    font-size: 25px;
    letter-spacing: -0.01em;
  }

  .book-meta {
    margin: 0 0 24px;
    color: var(--muted);
    font-size: 12px;
  }

  .line {
    margin: 0;
    color: #334259;
    font-size: 13.5px;
    line-height: 2;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .line-heading {
    margin-top: 18px;
    color: var(--accent);
    font-size: 15px;
    font-weight: 800;
    line-height: 1.6;
  }

  .line-blank {
    height: 12px;
  }

  .empty-state {
    display: grid;
    place-items: center;
    min-height: 320px;
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    text-align: center;
  }

  .empty-state.error {
    color: #dc2626;
  }

  .toc-list {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  .toc-list li {
    display: grid;
    grid-template-columns: 34px 1fr;
    gap: 8px;
    align-items: start;
    padding: 14px 0;
    border-bottom: 1px solid var(--border);
  }

  .toc-list li:last-child {
    border-bottom: 0;
  }

  .toc-list li > span {
    padding-top: 1px;
    color: var(--accent);
    font-family: "SFMono-Regular", Menlo, monospace;
    font-size: 11px;
  }

  .toc-list b {
    display: block;
    font-size: 13px;
    font-weight: 600;
  }

  .toc-list small {
    display: block;
    margin-top: 4px;
    color: var(--muted);
    font-size: 11px;
  }
</style>
