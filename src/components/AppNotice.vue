<script setup lang="ts">
  import type { AppNoticeMessage } from "../composables/useMessages";

  defineProps<{
    notices: readonly AppNoticeMessage[];
  }>();

  const emit = defineEmits<{
    dismiss: [id: number];
  }>();

  const noticeClass: Record<AppNoticeMessage["type"], string> = {
    info: "border-studio-line bg-[var(--panel)]",
    success: "border-green-500/50 bg-green-500/10",
    warning: "border-amber-500/50 bg-amber-500/10",
    error: "border-red-500/50 bg-red-500/10",
  };
</script>

<template>
  <div
    class="fixed inset-x-0 top-3 z-50 flex justify-center px-3"
    aria-live="polite"
  >
    <div class="grid w-full max-w-[380px] gap-2">
      <article
        v-for="notice in notices"
        :key="notice.id"
        :role="notice.type === 'error' ? 'alert' : 'status'"
        :class="[
          'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] text-studio-text shadow-sm backdrop-blur-sm',
          noticeClass[notice.type],
        ]"
      >
        <i
          :class="[
            'mt-0.5 shrink-0 text-base',
            notice.type === 'success'
              ? 'i-carbon:checkmark-filled text-green-600'
              : notice.type === 'error'
                ? 'i-carbon:error-filled text-red-500'
                : notice.type === 'warning'
                  ? 'i-carbon:warning-filled text-amber-500'
                  : 'i-carbon:information-filled text-studio-accent',
          ]"
        />
        <p class="m-0 flex-1 break-words leading-[1.5]">
          {{ notice.message }}
        </p>
        <button
          type="button"
          class="cursor-pointer border-0 bg-transparent p-0 text-studio-muted hover:text-studio-text"
          aria-label="关闭提示"
          @click="emit('dismiss', notice.id)"
        >
          <i class="i-carbon:close text-base" />
        </button>
      </article>
    </div>
  </div>
</template>
