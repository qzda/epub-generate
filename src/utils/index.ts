/**
 * 逐行读取超大文本文件（流式）
 * @param file - 用户上传的文件
 * @returns 异步生成器，每次返回一行文本
 */
export async function* readFileLines(file: File): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const reader = file.stream().getReader();
  let { value, done } = await reader.read();
  let buffer = "";

  while (!done) {
    buffer += decoder.decode(value, { stream: true });
    let lines = buffer.split("\n");
    buffer = lines.pop()!; // 保留最后未完整的一行

    for (const line of lines) {
      yield line;
    }

    ({ value, done } = await reader.read());
  }

  // 处理最后一行
  buffer += decoder.decode();
  if (buffer) {
    yield buffer;
  }
}
