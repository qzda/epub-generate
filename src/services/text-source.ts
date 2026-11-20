import { createChapterSplitter } from "../domain/chapter";
import type { Chapter, ChapterRef } from "../domain/chapter";
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

/**
 * 全文流式扫描：一次读取同时得到预览行和完整章节索引，
 * 保证目录数量与最终产物使用同一套分章规则。
 */
export async function scanTextSource(
  blob: Blob,
  encoding: TextEncoding,
  regex: RegExp,
  options: ScanTextSourceOptions = {}
): Promise<TextSourceScan> {
  const previewLimit = Math.max(
    0,
    options.previewLineCount ?? TEXT_PREVIEW_LINE_COUNT
  );
  const splitter = createChapterSplitter(regex, { keepContent: false });
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
  regex: RegExp,
  options: ReadFileLinesOptions = {}
): Promise<Chapter[]> {
  const splitter = createChapterSplitter(regex, { keepContent: true });

  for await (const line of readFileLines(blob, encoding, options)) {
    splitter.push(line);
  }

  return splitter.finish().chapters;
}
