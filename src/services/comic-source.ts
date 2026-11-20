import { unzip } from "fflate";
import type { Unzipped } from "fflate";
import { collectComicImages } from "../domain/comic";
import type { ComicImage } from "../domain/comic";
import { DomainError } from "../domain/result";
import { COMIC_PREVIEW_COUNT } from "../config/limits";
import { assertNotAborted } from "./abort";
import { toBlobPart } from "./binary";

export interface ComicImageData extends ComicImage {
  data: Uint8Array;
}

export interface ComicPreview {
  path: string;
  url: string;
}

export interface ComicSourceResult {
  images: ComicImageData[];
  previews: ComicPreview[];
  totalImages: number;
  dispose: () => void;
}

export interface ReadComicSourceOptions {
  previewLimit?: number;
  signal?: AbortSignal;
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
}

const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_EMPTY_SIGNATURE = 0x06054b50;

function readSignature(bytes: Uint8Array): number {
  if (bytes.length < 4) {
    return -1;
  }

  return (
    bytes[0] |
    (bytes[1] << 8) |
    (bytes[2] << 16) |
    (bytes[3] << 24)
  );
}

function unzipArchive(bytes: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    try {
      unzip(bytes, (error, files) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(files);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 读取 ZIP 中的图片，按文件名自然序返回完整清单，
 * 并为前 N 张图片创建预览 URL；调用方必须执行 dispose()。
 */
export async function readComicSource(
  blob: Blob,
  options: ReadComicSourceOptions = {}
): Promise<ComicSourceResult> {
  assertNotAborted(options.signal);

  const bytes = new Uint8Array(await blob.arrayBuffer());
  assertNotAborted(options.signal);

  if (bytes.length === 0) {
    throw new DomainError("EMPTY_ARCHIVE", "ZIP 文件为空");
  }

  const signature = readSignature(bytes);
  if (signature === ZIP_EMPTY_SIGNATURE) {
    throw new DomainError("EMPTY_ARCHIVE", "ZIP 压缩包为空");
  }
  if (signature !== ZIP_LOCAL_SIGNATURE) {
    throw new DomainError("UNSUPPORTED_FILE", "不是有效的 ZIP 文件");
  }

  let files: Unzipped;
  try {
    files = await unzipArchive(bytes);
  } catch (cause) {
    throw new DomainError("UNSUPPORTED_FILE", "无法读取 ZIP 文件", { cause });
  }
  assertNotAborted(options.signal);

  const imagePaths = collectComicImages(Object.keys(files));
  if (imagePaths.length === 0) {
    throw new DomainError("NO_IMAGES", "ZIP 中没有可用的图片");
  }

  const images: ComicImageData[] = imagePaths.map((image) => ({
    ...image,
    data: files[image.path],
  }));

  const createObjectUrl =
    options.createObjectUrl ?? ((value: Blob) => URL.createObjectURL(value));
  const limit = Math.min(
    images.length,
    Math.max(0, options.previewLimit ?? COMIC_PREVIEW_COUNT)
  );

  const previews: ComicPreview[] = images.slice(0, limit).map((image) => ({
    path: image.path,
    url: createObjectUrl(
      new Blob([toBlobPart(image.data)], { type: image.mimeType })
    ),
  }));

  let disposed = false;
  const revokeObjectUrl =
    options.revokeObjectUrl ?? ((url: string) => URL.revokeObjectURL(url));

  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;

    for (const preview of previews) {
      revokeObjectUrl(preview.url);
    }
  };

  return {
    images,
    previews,
    totalImages: images.length,
    dispose,
  };
}
