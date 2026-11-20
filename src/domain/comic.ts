export type ImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp"
  | "image/bmp";

export interface ComicImage {
  path: string;
  baseName: string;
  extension: string;
  mimeType: ImageMimeType;
}

export const IMAGE_MIME_TYPES: Record<string, ImageMimeType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

const collator = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function isDirectoryPath(path: string): boolean {
  return /[\\/]$/.test(path);
}

export function getBaseName(path: string): string {
  const normalized = normalizePath(path).replace(/\/+$/, "");
  const separatorIndex = normalized.lastIndexOf("/");
  return separatorIndex === -1 ? normalized : normalized.slice(separatorIndex + 1);
}

export function getImageExtension(path: string): string | undefined {
  if (isDirectoryPath(path)) {
    return undefined;
  }

  const baseName = getBaseName(path).toLowerCase();
  const dotIndex = baseName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return undefined;
  }

  const extension = baseName.slice(dotIndex);
  return extension in IMAGE_MIME_TYPES ? extension : undefined;
}

export function getImageMimeType(path: string): ImageMimeType | undefined {
  const extension = getImageExtension(path);
  return extension ? IMAGE_MIME_TYPES[extension] : undefined;
}

export function isImagePath(path: string): boolean {
  return getImageExtension(path) !== undefined;
}

export function compareComicPaths(a: string, b: string): number {
  const byBaseName = collator.compare(getBaseName(a), getBaseName(b));
  if (byBaseName !== 0) {
    return byBaseName;
  }

  return collator.compare(a, b);
}

export function orderImageEntries(paths: readonly string[]): string[] {
  return paths
    .filter((path) => !isDirectoryPath(path) && isImagePath(path))
    .sort(compareComicPaths);
}

export function collectComicImages(paths: readonly string[]): ComicImage[] {
  return orderImageEntries(paths).map((path) => {
    const extension = getImageExtension(path) as string;

    return {
      path,
      baseName: getBaseName(path),
      extension,
      mimeType: IMAGE_MIME_TYPES[extension],
    };
  });
}
