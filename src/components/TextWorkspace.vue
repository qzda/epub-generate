<script setup lang="ts">
  import { computed, ref } from "vue";
  import {
    PREAMBLE_TITLE,
    normalizeChapterLevels,
  } from "../domain/chapter";
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

  const tocRows = computed(() => {
    const levels = normalizeChapterLevels(
      props.chapters.map((chapter) => chapter.level)
    );

    return props.chapters.map((chapter, index) => ({
      ...chapter,
      level: levels[index] ?? 1,
      number: index + 1,
    }));
  });

  const topLevelRows = computed(() =>
    tocRows.value.filter((row) => row.level === 1)
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
        v-for="row in topLevelRows"
        :key="`${row.startLine}-${row.number}`"
        type="button"
        @click="activeView = 'toc'"
      >
        <b>{{ String(row.number).padStart(2, "0") }}</b>
        {{ row.title }}
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
            {{ bookAuthor || "未知作者" }} · {{ chapters.length }} 个目录项 · EPUB 3
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
            v-for="row in tocRows"
            :key="`${row.startLine}-${row.number}`"
            :class="`toc-level-${row.level}`"
          >
            <span>{{ String(row.number).padStart(2, "0") }}</span>
            <div>
              <b>{{ row.title }}</b>
              <small>从第 {{ row.startLine + 1 }} 行开始</small>
            </div>
          </li>
        </ol>
      </template>
    </div>
  </section>
</template>

<style scoped>
  .main-card {
    display: flex;
    flex-direction: column;
    height: clamp(480px, calc(100dvh - 350px), 840px);
  }

  .main-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px 16px 10px;
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
    background: var(--panel-muted);
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
    background: var(--panel);
    color: var(--accent);
    box-shadow: 0 4px 12px -8px rgba(21, 34, 56, 0.5);
  }

  .toc-strip {
    flex: 0 0 auto;
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 0 16px 10px;
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
    background: var(--panel-muted);
    color: var(--muted);
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
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    padding: 4px 18px 20px;
    border-top: 1px solid var(--border);
    background:
      linear-gradient(
        90deg,
        rgba(47, 99, 233, 0.035) 0,
        transparent 12%,
        transparent 88%,
        rgba(47, 99, 233, 0.035) 100%
      ),
      var(--panel);
  }

  .book-title {
    margin: 14px 0 3px;
    font-size: 23px;
    letter-spacing: -0.01em;
  }

  .book-meta {
    margin: 0 0 16px;
    color: var(--muted);
    font-size: 12px;
  }

  .line {
    margin: 0;
    color: var(--foreground);
    font-size: 13.5px;
    line-height: 1.9;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .line-heading {
    margin-top: 14px;
    color: var(--accent);
    font-size: 14.5px;
    font-weight: 800;
    line-height: 1.6;
  }

  .line-blank {
    height: 10px;
  }

  .empty-state {
    display: grid;
    place-items: center;
    min-height: 280px;
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    text-align: center;
  }

  .empty-state.error {
    color: #dc2626;
  }

  .toc-list {
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
  }

  .toc-list li {
    display: grid;
    grid-template-columns: 34px 1fr;
    gap: 8px;
    align-items: start;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }

  .toc-list li:last-child {
    border-bottom: 0;
  }

  .toc-list li.toc-level-2 {
    padding-left: 20px;
  }

  .toc-list li.toc-level-3 {
    padding-left: 40px;
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

  @media (max-width: 960px) {
    .main-card {
      height: clamp(360px, calc(100dvh - 470px), 700px);
    }
  }
</style>
