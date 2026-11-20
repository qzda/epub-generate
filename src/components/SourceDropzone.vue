<script setup lang="ts">
  defineProps<{
    active?: boolean;
    disabled?: boolean;
  }>();

  const emit = defineEmits<{
    pick: [];
  }>();
</script>

<template>
  <button
    type="button"
    class="studio-empty-shell w-full cursor-pointer transition-[border-color,background-color,box-shadow] duration-150"
    :class="
      active
        ? 'border-studio-accent bg-studio-accent-soft shadow-[0_20px_50px_-35px_rgba(47,99,233,0.7)]'
        : 'hover:border-studio-accent hover:shadow-[0_20px_50px_-38px_rgba(21,34,56,0.45)]'
    "
    :disabled="disabled"
    aria-label="选择要转换的文件"
    @click="emit('pick')"
  >
    <span class="empty-icon">
      <i class="i-carbon:document-add text-[24px]" />
    </span>
    <span class="empty-title">把文字或图包拖进来</span>
    <span class="empty-copy">
      TXT/MD 支持正则分章，ZIP 图片包自动按文件名排页。
    </span>
    <span class="empty-hint">或点击选择文件</span>
  </button>
</template>

<style scoped>
  .empty-icon {
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    margin: 0 auto 4px;
    border-radius: 16px;
    background: var(--accent-soft);
    color: var(--accent);
  }

  .empty-title {
    color: var(--foreground);
    font-size: 19px;
    font-weight: 700;
  }

  .empty-copy {
    color: var(--muted);
    font-size: 13px;
  }

  .empty-hint {
    margin-top: 2px;
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
  }
</style>
