<script setup lang="ts">
  import { computed, ref, watch } from "vue";
  import { readFileLines } from "./utils";

  const file = ref<File>();
  const lines = ref<string[]>();
  const fileAsyncGenerator = ref<ReturnType<typeof readFileLines>>();
  const regexText = ref<string>();
  const regex = computed(() => {
    if (regexText.value) {
      try {
        return new RegExp(regexText.value);
      } catch (error) {}
    }
    return;
  });

  watch([lines, regex], ([_lines, _regex]) => {
    if (_regex && _lines?.length) {
      _lines.forEach((_line, index) => {
        const match = _line.match(_regex);
        if (match) {
          // todo
          console.log(index, match);
        }
      });
    }
  });

  async function onFileChange(e: Event) {
    const _file = (e.target as HTMLInputElement).files?.item(0);

    if (_file && _file.size < 50 * 1048576) {
      file.value = _file;
      fileAsyncGenerator.value = readFileLines(_file);
      lines.value = [];

      let count = 0;
      for await (const line of fileAsyncGenerator.value) {
        if (count >= 20) {
          break;
        }

        lines.value.push(line);

        if (line.trim().length) {
          count++;
        }
      }
    }
  }
</script>

<template>
  <div class="flex justify-between mb-4">
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

  <div class="flex">
    <div class="flex-1">
      <input
        v-model="regexText"
        class="border-base shadow-base focus:border-gray-800"
        type="text"
        id="regex"
      />
    </div>
    <div class="flex-1">
      <div
        class="mb-2"
        v-if="file"
      >
        <span class="font-bold bg-gray">{{ file.name }}</span>
        <div class="text-gray">{{ file.size }}byte</div>
      </div>
      <div
        class="text-sm border-base border-dashed"
        v-if="lines?.length"
      >
        <p v-for="line in lines">{{ line || "&nbsp;" }}</p>
      </div>
    </div>
  </div>
</template>
