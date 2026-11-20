<script setup lang="ts">
  import { computed } from "vue";
  import {
    EncodingList,
    normalizeEncodingName,
  } from "../domain/encoding";
  import type { TextEncoding } from "../domain/encoding";
  import type { AppError } from "../domain/result";

  const encoding = defineModel<TextEncoding>("encoding", { required: true });
  const pattern = defineModel<string>("pattern", { required: true });

  const props = defineProps<{
    chapterCount: number;
    totalLines: number;
    isScanning: boolean;
    isDetectingEncoding?: boolean;
    encodingFallback: boolean;
    detectedEncoding: string | null;
    error?: AppError | null;
  }>();

  const isAutoDetectedEncoding = computed(() => {
    if (!props.detectedEncoding || props.encodingFallback) {
      return false;
    }

    return normalizeEncodingName(props.detectedEncoding) === encoding.value;
  });
</script>

<template>
  <div class="grid gap-3">
    <div class="grid gap-1.5">
      <label
        for="textEncoding"
        class="studio-label"
      >
        文本编码
      </label>
      <select
        id="textEncoding"
        v-model="encoding"
        class="studio-input cursor-pointer"
      >
        <option
          v-for="encodingOption in EncodingList"
          :key="encodingOption"
          :value="encodingOption"
        >
          {{ encodingOption }}
        </option>
      </select>
      <p class="studio-note">
        <template v-if="encodingFallback">
          未识别出可靠编码，已回退 {{ encoding }}
        </template>
        <template v-else-if="isAutoDetectedEncoding">
          自动检测：{{ detectedEncoding }}
        </template>
        <template v-else>
          当前编码：{{ encoding }}
        </template>
      </p>
    </div>

    <div class="grid gap-1.5">
      <label
        for="chapterPattern"
        class="studio-label"
      >
        章节正则
      </label>
      <input
        id="chapterPattern"
        v-model="pattern"
        class="studio-input font-mono"
        type="text"
        placeholder="例如：^\s*第\d+章"
        spellcheck="false"
        autocomplete="off"
      />
      <p
        v-if="error"
        class="m-0 text-xs text-red-500"
        role="alert"
      >
        {{ error.message }}
      </p>
      <p
        v-else
        class="studio-note"
      >
        <template v-if="isDetectingEncoding">正在检测编码…</template>
        <template v-else-if="isScanning">正在扫描全文…</template>
        <template v-else>
          匹配到 {{ chapterCount }} 个章节 · 共 {{ totalLines }} 行
        </template>
      </p>
    </div>
  </div>
</template>
