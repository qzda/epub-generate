import { onScopeDispose, ref, shallowRef, toValue, watch } from "vue";
import type { MaybeRefOrGetter } from "vue";
import type { AppError } from "../domain/result";
import { COMIC_PREVIEW_COUNT } from "../config/limits";
import { isAbortError } from "../services/abort";
import { readComicSource } from "../services/comic-source";
import type {
  ComicImageData,
  ComicPreview,
  ComicSourceResult,
} from "../services/comic-source";

export function useComicSource(file: MaybeRefOrGetter<File | undefined>) {
  const previews = ref<ComicPreview[]>([]);
  const images = shallowRef<ComicImageData[]>([]);
  const totalImages = ref(0);
  const isLoading = ref(false);
  const error = ref<AppError | null>(null);

  let current: ComicSourceResult | null = null;
  let controller: AbortController | null = null;
  let requestId = 0;

  function disposeCurrent(): void {
    current?.dispose();
    current = null;
    previews.value = [];
    images.value = [];
    totalImages.value = 0;
  }

  async function load(): Promise<void> {
    controller?.abort();
    controller = null;
    disposeCurrent();
    error.value = null;

    const source = toValue(file);
    if (!source) {
      isLoading.value = false;
      return;
    }

    const currentController = new AbortController();
    controller = currentController;
    const currentId = requestId + 1;
    requestId = currentId;
    isLoading.value = true;

    try {
      const result = await readComicSource(source, {
        previewLimit: COMIC_PREVIEW_COUNT,
        signal: currentController.signal,
      });

      if (currentId !== requestId) {
        result.dispose();
        return;
      }

      current = result;
      previews.value = result.previews;
      images.value = result.images;
      totalImages.value = result.totalImages;
    } catch (cause) {
      if (currentId !== requestId || isAbortError(cause)) {
        return;
      }

      error.value = {
        code: "UNSUPPORTED_FILE",
        message:
          cause instanceof Error ? cause.message : "漫画压缩包读取失败",
      };
    } finally {
      if (currentId === requestId) {
        isLoading.value = false;
      }
    }
  }

  watch(
    () => toValue(file),
    () => {
      void load();
    },
    { immediate: true }
  );

  onScopeDispose(() => {
    controller?.abort();
    disposeCurrent();
  });

  return {
    previews,
    images,
    totalImages,
    isLoading,
    error,
    reload: load,
  };
}
