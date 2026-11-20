import { strToU8, zip } from "fflate";
import type { Zippable } from "fflate";
import { DomainError } from "../domain/result";
import type { EpubEntry } from "../domain/epub/types";
import { assertNotAborted, createAbortError } from "./abort";
import { toBlobPart } from "./binary";

export interface PackEpubOptions {
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

export const EPUB_BLOB_TYPE = "application/epub+zip";

/**
 * 固定为本地时间 1980-01-01，保证同样输入生成同样的 ZIP 字节。
 * 使用本地时间构造，避免不同时区得到不同的 DOS 时间戳。
 */
const ZIP_MTIME = new Date(1980, 0, 1, 0, 0, 0);

function toBytes(data: string | Uint8Array): Uint8Array {
  return typeof data === "string" ? strToU8(data) : data;
}

/**
 * 唯一接触 fflate 的地方。
 * 使用非流式 zip API，确保 mimetype 的本地文件头包含真实大小、无 data descriptor。
 */
export async function packEpub(
  entries: EpubEntry[],
  options: PackEpubOptions = {}
): Promise<Blob> {
  if (entries.length === 0) {
    throw new DomainError("PACK_FAILED", "没有可打包的文件");
  }
  if (entries[0].path !== "mimetype") {
    throw new DomainError("PACK_FAILED", "mimetype 必须是第一个文件");
  }

  const { onProgress, signal } = options;
  const zippable: Zippable = {};

  onProgress?.(0);

  for (const entry of entries) {
    assertNotAborted(signal);

    const shouldStore =
      entry.path === "mimetype" || entry.compression === "STORE";
    zippable[entry.path] = [
      toBytes(entry.data),
      {
        level: shouldStore ? 0 : 6,
        mtime: ZIP_MTIME,
      },
    ];
  }

  onProgress?.(0.2);

  return new Promise<Blob>((resolve, reject) => {
    const onAbort = () => {
      reject(createAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      zip(
        zippable,
        { level: 6, mtime: ZIP_MTIME },
        (error, data) => {
          signal?.removeEventListener("abort", onAbort);

          if (signal?.aborted) {
            reject(createAbortError());
            return;
          }

          if (error) {
            reject(
              new DomainError("PACK_FAILED", "EPUB 打包失败", {
                cause: error,
              })
            );
            return;
          }

          onProgress?.(1);
          resolve(new Blob([toBlobPart(data)], { type: EPUB_BLOB_TYPE }));
        }
      );
    } catch (cause) {
      signal?.removeEventListener("abort", onAbort);
      reject(new DomainError("PACK_FAILED", "EPUB 打包失败", { cause }));
    }
  });
}
