/** 使用指定编码读取文件 */
export async function* readFileLinesWithEncoding(
  file: File,
  encoding: string
): AsyncGenerator<string> {
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(encoding);
  } catch {
    throw new Error(`不支持的文本编码: ${encoding}`);
  }

  const chunkSize = 64 * 1024; // 64KB
  let buffer = "";
  let offset = 0;

  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize);
    const arrayBuffer = await chunk.arrayBuffer();
    const decoded = decoder.decode(arrayBuffer, { stream: true });
    buffer += decoded;

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      yield line.replace(/\r$/, "");
    }

    offset += chunkSize;
  }

  buffer += decoder.decode();

  if (buffer) {
    const lines = buffer.split("\n");
    for (const line of lines) {
      yield line.replace(/\r$/, "");
    }
  }
}
