<script setup lang="ts">
  import { ref } from "vue";
  import { readFileLines } from "./utils";

  const file = ref<File>();

  async function onFileChange(e: Event) {
    const _file = (e.target as HTMLInputElement).files?.item(0);

    if (_file && _file.size < 50 * 1048576) {
      file.value = _file;

      readFileLines(_file)
        .next()
        .then((res) => {
          console.log(res.value);
        });
    }
  }
</script>

<template>
  <div class="flex justify-between">
    <h1 class="text-xl text-black dark:text-white">EPUB Generate</h1>
    <div>
      <div>
        <label
          class="btn text-sm"
          for="uploadTextFile"
        >
          <i class="i-carbon:upload"
        /></label>

        <input
          class="hidden"
          type="file"
          id="uploadTextFile"
          accept="text/*"
          @change="onFileChange"
        />
      </div>
    </div>
  </div>
  <div>
    <h2>{{ file?.name }}</h2>
    <div>{{ file?.size }}</div>
  </div>
</template>
