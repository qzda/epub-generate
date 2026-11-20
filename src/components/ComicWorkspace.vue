<script setup lang="ts">
  import { getBaseName } from "../domain/comic";
  import type { AppError } from "../domain/result";
  import type { ComicPreview } from "../services/comic-source";

  defineProps<{
    previews: ComicPreview[];
    totalImages: number;
    isLoading: boolean;
    error?: AppError | null;
  }>();
</script>

<template>
  <section class="studio-panel comic-card">
    <div class="main-head">
      <div>
        <h2>漫画预览</h2>
        <p>共 {{ totalImages }} 页 · 前 {{ previews.length }} 张</p>
      </div>
    </div>

    <div class="comic-body">
      <p
        v-if="isLoading"
        class="comic-empty"
      >
        正在读取图片包…
      </p>
      <p
        v-else-if="error"
        class="comic-empty error"
        role="alert"
      >
        {{ error.message }}
      </p>
      <p
        v-else-if="previews.length === 0"
        class="comic-empty"
      >
        压缩包中未找到可预览的图片
      </p>
      <div
        v-else
        class="comic-grid"
      >
        <figure
          v-for="(image, index) in previews"
          :key="`${image.path}-${index}`"
        >
          <img
            :src="image.url"
            :alt="getBaseName(image.path)"
            loading="lazy"
          />
          <figcaption>
            <b>{{ getBaseName(image.path) }}</b>
            <span>{{ String(index + 1).padStart(2, "0") }}</span>
          </figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>

<style scoped>
  .comic-card {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 700px;
  }

  .main-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 17px 20px 15px;
    border-bottom: 1px solid var(--border);
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

  .comic-body {
    padding: 20px;
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

  .comic-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  @media (min-width: 640px) {
    .comic-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (min-width: 1280px) {
    .comic-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  figure {
    position: relative;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--panel-muted);
  }

  img {
    display: block;
    width: 100%;
    height: 168px;
    object-fit: cover;
    background: var(--panel-muted);
  }

  figcaption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    color: var(--muted);
    font-size: 11px;
  }

  figcaption b {
    overflow: hidden;
    color: var(--muted);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  figcaption span {
    flex: 0 0 auto;
    color: var(--accent);
    font-family: "SFMono-Regular", Menlo, monospace;
    font-size: 10px;
  }

  .comic-empty {
    display: grid;
    place-items: center;
    min-height: 420px;
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    text-align: center;
  }

  .comic-empty.error {
    color: #dc2626;
  }
</style>
