import { createChapterSplitter } from "../domain/chapter";
import type {
  Chapter,
  ChapterPatternInput,
  ChapterRef,
} from "../domain/chapter";
import type { TextEncoding } from "../domain/encoding";
import { TEXT_PREVIEW_LINE_COUNT } from "../config/limits";
import { readFileLines } from "./line-reader";
import type { ReadFileLinesOptions } from "./line-reader";

export interface TextSourceScan {
  previewLines: string[];
  chapterRefs: ChapterRef[];
  totalLines: number;
  matchedCount: number;
}

export interface ScanTextSourceOptions extends ReadFileLinesOptions {
  previewLineCount?: number;
}

export interface ReadTextChaptersOptions extends ReadFileLinesOptions {
  /** 已处理行数，用于导出时展示读取进度。 */
  onProgress?: (processedLines: number) => void;
}

/**
 * 全文流式扫描：一次读取同时得到预览行和完整章节索引，
 * 保证目录数量与最终产物使用同一套分章规则。
 */
export async function scanTextSource(
  blob: Blob,
  encoding: TextEncoding,
  patterns: ChapterPatternInput,
  options: ScanTextSourceOptions = {}
): Promise<TextSourceScan> {
  const previewLimit = Math.max(
    0,
    options.previewLineCount ?? TEXT_PREVIEW_LINE_COUNT
  );
  const splitter = createChapterSplitter(patterns, { keepContent: false });
  const previewLines: string[] = [];

  for await (const line of readFileLines(blob, encoding, options)) {
    if (previewLines.length < previewLimit) {
      previewLines.push(line);
    }
    splitter.push(line);
  }

  const result = splitter.finish();

  return {
    previewLines,
    chapterRefs: result.refs,
    totalLines: result.lineCount,
    matchedCount: result.matchedCount,
  };
}

/** 全文读取并保留章节正文，用于最终导出。 */
export async function readTextChapters(
  blob: Blob,
  encoding: TextEncoding,
  patterns: ChapterPatternInput,
  options: ReadTextChaptersOptions = {}
): Promise<Chapter[]> {
  const { onProgress, ...readOptions } = options;
  const splitter = createChapterSplitter(patterns, { keepContent: true });
  let processedLines = 0;
  let lastReported = 0;

  for await (const line of readFileLines(blob, encoding, readOptions)) {
    splitter.push(line);
    processedLines += 1;

    if (processedLines - lastReported >= 200) {
      lastReported = processedLines;
      onProgress?.(processedLines);
    }
  }

  onProgress?.(processedLines);

  return splitter.finish().chapters;
}
