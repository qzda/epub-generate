export interface DownloadDependencies {
  document?: Document;
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
}

/**
 * 触发浏览器下载，并确保对象 URL 在同步流程结束后释放。
 */
export function downloadBlob(
  blob: Blob,
  fileName: string,
  dependencies: DownloadDependencies = {}
): void {
  const doc = dependencies.document ?? document;
  const createObjectUrl =
    dependencies.createObjectUrl ?? ((value: Blob) => URL.createObjectURL(value));
  const revokeObjectUrl =
    dependencies.revokeObjectUrl ?? ((url: string) => URL.revokeObjectURL(url));

  if (!doc.body) {
    throw new Error("document.body 不可用，无法触发下载");
  }

  const url = createObjectUrl(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";

  try {
    doc.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    revokeObjectUrl(url);
  }
}
