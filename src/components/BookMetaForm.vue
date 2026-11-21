<script setup lang="ts">
  const title = defineModel<string>("title", { required: true });
  const author = defineModel<string>("author", { required: true });
</script>

<template>
  <div class="grid gap-2">
    <div class="grid gap-1.5">
      <label
        for="bookTitle"
        class="studio-label"
      >
        书名
      </label>
      <input
        id="bookTitle"
        v-model="title"
        class="studio-input"
        type="text"
        placeholder="请输入书名"
        autocomplete="off"
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
        v-model="author"
        class="studio-input"
        type="text"
        placeholder="请输入作者"
        autocomplete="off"
      />
    </div>
  </div>
</template>
