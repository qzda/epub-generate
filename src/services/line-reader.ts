import { DomainError } from "../domain/result";
import type { TextEncoding } from "../domain/encoding";
import { FILE_READ_CHUNK_SIZE } from "../config/limits";
import { assertNotAborted } from "./abort";

export interface ReadFileLinesOptions {
  chunkSize?: number;
  signal?: AbortSignal;
}

/**
 * 按指定编码分块读取文本，并把 `\r\n`、`\n`、单独 `\r` 统一视为换行。
 * 末尾换行不会额外产生空行。
 */
export async function* readFileLines(
  blob: Blob,
  encoding: TextEncoding,
  options: ReadFileLinesOptions = {}
): AsyncGenerator<string> {
  const chunkSize = Math.max(1, options.chunkSize ?? FILE_READ_CHUNK_SIZE);
  const signal = options.signal;

  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(encoding);
  } catch (cause) {
    throw new DomainError(
      "INVALID_ENCODING",
      `不支持的文本编码：${encoding}`,
      { cause }
    );
  }

  let offset = 0;
  let carry = "";
  let pendingCR = false;

  while (offset < blob.size) {
    assertNotAborted(signal);

    const end = Math.min(offset + chunkSize, blob.size);
    const bytes = new Uint8Array(await blob.slice(offset, end).arrayBuffer());
    offset = end;

    const text = decoder.decode(bytes, { stream: true });
    let lineStart = 0;

    if (pendingCR && text.length > 0) {
      pendingCR = false;
      if (text.charCodeAt(0) === 0x0a) {
        lineStart = 1;
      }
    }

    for (let index = lineStart; index < text.length; index += 1) {
      const code = text.charCodeAt(index);

      if (code === 0x0d) {
        yield carry + text.slice(lineStart, index);
        carry = "";
        lineStart = index + 1;

        if (text.charCodeAt(lineStart) === 0x0a) {
          lineStart += 1;
          index += 1;
        } else if (lineStart >= text.length) {
          pendingCR = true;
        }
      } else if (code === 0x0a) {
        yield carry + text.slice(lineStart, index);
        carry = "";
        lineStart = index + 1;
      }
    }

    carry += text.slice(lineStart);
  }

  carry += decoder.decode();

  if (carry.length > 0) {
    yield carry;
  }
}
