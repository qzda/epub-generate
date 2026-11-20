import { watchDebounced } from "@vueuse/core";
import { onScopeDispose, ref, toValue } from "vue";
import type { MaybeRefOrGetter } from "vue";
import { compileChapterPattern } from "../domain/chapter";
import type { ChapterRef } from "../domain/chapter";
import type { TextEncoding } from "../domain/encoding";
import type { AppError } from "../domain/result";
import { TEXT_PREVIEW_LINE_COUNT } from "../config/limits";
import { isAbortError } from "../services/abort";
import { scanTextSource } from "../services/text-source";

export interface UseTextSourceOptions {
  previewLineCount?: number;
  debounce?: number;
}

export function useTextSource(
  file: MaybeRefOrGetter<File | undefined>,
  encoding: MaybeRefOrGetter<TextEncoding>,
  pattern: MaybeRefOrGetter<string>,
  options: UseTextSourceOptions = {}
) {
  const previewLines = ref<string[]>([]);
  const chapterRefs = ref<ChapterRef[]>([]);
  const totalLines = ref(0);
  const matchedCount = ref(0);
  const isScanning = ref(false);
  const error = ref<AppError | null>(null);

  let controller: AbortController | null = null;
  let requestId = 0;

  function reset(): void {
    previewLines.value = [];
    chapterRefs.value = [];
    totalLines.value = 0;
    matchedCount.value = 0;
    error.value = null;
  }

  async function scan(): Promise<void> {
    controller?.abort();
    controller = null;

    const source = toValue(file);
    if (!source) {
      reset();
      isScanning.value = false;
      return;
    }

    const compiled = compileChapterPattern(toValue(pattern));
    if (!compiled.ok) {
      error.value = compiled.error;
      chapterRefs.value = [];
      matchedCount.value = 0;
      isScanning.value = false;
      return;
    }

    const currentController = new AbortController();
    controller = currentController;
    const currentId = requestId + 1;
    requestId = currentId;

    isScanning.value = true;
    error.value = null;
    previewLines.value = [];
    chapterRefs.value = [];
    totalLines.value = 0;
    matchedCount.value = 0;

    try {
      const result = await scanTextSource(
        source,
        toValue(encoding),
        compiled.value,
        {
          previewLineCount:
            options.previewLineCount ?? TEXT_PREVIEW_LINE_COUNT,
          signal: currentController.signal,
        }
      );

      if (currentId !== requestId) {
        return;
      }

      previewLines.value = result.previewLines;
      chapterRefs.value = result.chapterRefs;
      totalLines.value = result.totalLines;
      matchedCount.value = result.matchedCount;
    } catch (cause) {
      if (currentId !== requestId || isAbortError(cause)) {
        return;
      }

      error.value = {
        code: "UNSUPPORTED_FILE",
        message:
          cause instanceof Error ? cause.message : "文本扫描失败",
      };
    } finally {
      if (currentId === requestId) {
        isScanning.value = false;
      }
    }
  }

  watchDebounced(
    [
      () => toValue(file),
      () => toValue(encoding),
      () => toValue(pattern),
    ],
    () => {
      void scan();
    },
    {
      debounce: options.debounce ?? 250,
      immediate: true,
    }
  );

  onScopeDispose(() => {
    controller?.abort();
  });

  return {
    previewLines,
    chapterRefs,
    totalLines,
    matchedCount,
    isScanning,
    error,
    rescan: scan,
  };
}
