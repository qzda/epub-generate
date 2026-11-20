import { onScopeDispose, ref } from "vue";
import { DomainError } from "../domain/result";
import type { AppError } from "../domain/result";
import { isAbortError } from "../services/abort";

export type ExportStage =
  | "idle"
  | "reading"
  | "building"
  | "packing"
  | "done";

export type ReportProgress = (stage: ExportStage, ratio: number) => void;

export function useExport() {
  const isGenerating = ref(false);
  const progress = ref(0);
  const stage = ref<ExportStage>("idle");
  const error = ref<AppError | null>(null);

  let controller: AbortController | null = null;

  async function run<T>(
    task: (report: ReportProgress, signal: AbortSignal) => Promise<T>
  ): Promise<T | undefined> {
    if (isGenerating.value) {
      return undefined;
    }

    isGenerating.value = true;
    progress.value = 0;
    stage.value = "reading";
    error.value = null;

    const currentController = new AbortController();
    controller = currentController;

    const report: ReportProgress = (nextStage, ratio) => {
      stage.value = nextStage;
      progress.value = Math.min(1, Math.max(0, ratio));
    };

    try {
      const result = await task(report, currentController.signal);
      progress.value = 1;
      stage.value = "done";
      return result;
    } catch (cause) {
      if (isAbortError(cause)) {
        return undefined;
      }

      error.value =
        cause instanceof DomainError
          ? { code: cause.code, message: cause.message }
          : {
              code: "PACK_FAILED",
              message:
                cause instanceof Error ? cause.message : "EPUB 生成失败",
            };
      stage.value = "idle";
      progress.value = 0;
      return undefined;
    } finally {
      isGenerating.value = false;
      controller = null;
    }
  }

  function cancel(): void {
    controller?.abort();
  }

  onScopeDispose(cancel);

  return {
    isGenerating,
    progress,
    stage,
    error,
    run,
    cancel,
  };
}
