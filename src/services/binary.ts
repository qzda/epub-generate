/**
 * 把 Uint8Array 转成 BlobPart。
 * 新版 TS 的 BlobPart 不接受 SharedArrayBuffer 支撑的视图，
 * 因此仅对 ArrayBuffer 支撑的视图做零拷贝转换，其余情况复制。
 */
export function toBlobPart(data: Uint8Array): BlobPart {
  if (data.buffer instanceof ArrayBuffer) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy;
}
