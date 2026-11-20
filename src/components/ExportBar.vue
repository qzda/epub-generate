<script setup lang="ts">
  import { computed } from "vue";
  import type { ExportStage } from "../composables/useExport";

  const props = defineProps<{
    disabled: boolean;
    isGenerating: boolean;
    progress: number;
    stage: ExportStage;
  }>();

  const emit = defineEmits<{
    export: [];
  }>();

  const stageLabel = computed(() => {
    switch (props.stage) {
      case "reading":
        return "读取文件…";
      case "building":
        return "构建 EPUB…";
      case "packing":
        return "压缩打包…";
      case "done":
        return "生成完成";
      default:
        return "";
    }
  });
</script>

<template>
  <div class="grid min-w-[140px] gap-2 max-md:w-full">
    <button
      type="button"
      class="btn btn-primary w-full md:w-auto"
      :class="disabled || isGenerating ? 'btn-disable' : ''"
      :disabled="disabled || isGenerating"
      :aria-busy="isGenerating"
      @click="emit('export')"
    >
      <i class="i-carbon:book" />
      <span>{{ isGenerating ? "生成中..." : "生成 EPUB" }}</span>
    </button>

    <div
      v-if="isGenerating"
      class="grid gap-1"
    >
      <progress
        class="epub-progress h-1.5 w-full"
        :value="Math.round(progress * 100)"
        max="100"
        aria-label="EPUB 生成进度"
      />
      <span
        class="text-center text-[11px] text-studio-muted"
        role="status"
      >
        {{ stageLabel }} {{ Math.round(progress * 100) }}%
      </span>
    </div>
  </div>
</template>

<style scoped>
  .epub-progress {
    appearance: none;
    border: 0;
    border-radius: 999px;
    overflow: hidden;
    background: var(--panel-muted);
  }

  .epub-progress::-webkit-progress-bar {
    background: var(--panel-muted);
  }

  .epub-progress::-webkit-progress-value {
    background: var(--accent);
  }

  .epub-progress::-moz-progress-bar {
    background: var(--accent);
  }
</style>
