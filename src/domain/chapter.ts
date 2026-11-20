import { DomainError, fail, ok } from "./result";
import type { AppError, Result } from "./result";

export interface Chapter {
  title: string;
  paragraphs: string[];
}

export interface ChapterRef {
  title: string;
  startLine: number;
}

export interface ChapterSplitOptions {
  keepContent?: boolean;
}

export interface ChapterSplitResult {
  chapters: Chapter[];
  refs: ChapterRef[];
  matchedCount: number;
  lineCount: number;
}

export interface ChapterSplitter {
  push(line: string): boolean;
  finish(): ChapterSplitResult;
}

export const PREAMBLE_TITLE = "前言";
export const FALLBACK_CHAPTER_TITLE = "正文";

export function compileChapterPattern(source: string): Result<RegExp, AppError> {
  if (!source.trim()) {
    return fail({
      code: "INVALID_PATTERN",
      message: "章节正则不能为空",
    });
  }

  try {
    return ok(new RegExp(source));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return fail({
      code: "INVALID_PATTERN",
      message: `章节正则无效：${detail}`,
    });
  }
}

export function createChapterSplitter(
  regex: RegExp,
  options: ChapterSplitOptions = {}
): ChapterSplitter {
  const keepContent = options.keepContent ?? true;
  const matcher = new RegExp(regex.source, regex.flags.replace(/[gy]/g, ""));

  const chapters: Chapter[] = [];
  const refs: ChapterRef[] = [];
  let currentChapter: Chapter | null = null;
  let preamble: string[] = [];
  let preambleHasContent = false;
  let preambleStartLine = 0;
  let matchedCount = 0;
  let lineCount = 0;
  let finished = false;
  let result: ChapterSplitResult | null = null;

  function push(line: string): boolean {
    if (finished) {
      throw new DomainError("INVALID_PATTERN", "分章器已经结束，不能继续写入");
    }

    const lineIndex = lineCount;
    lineCount += 1;

    if (matcher.test(line)) {
      matchedCount += 1;

      if (currentChapter) {
        chapters.push(currentChapter);
      } else if (preambleHasContent) {
        chapters.push({
          title: PREAMBLE_TITLE,
          paragraphs: keepContent ? preamble : [],
        });
        refs.push({
          title: PREAMBLE_TITLE,
          startLine: preambleStartLine,
        });
        preamble = [];
      }

      currentChapter = {
        title: line.trim(),
        paragraphs: [],
      };
      refs.push({
        title: currentChapter.title,
        startLine: lineIndex,
      });

      return true;
    }

    if (!line.trim()) {
      return false;
    }

    if (currentChapter) {
      if (keepContent) {
        currentChapter.paragraphs.push(line);
      }
      return false;
    }

    preambleHasContent = true;
    if (!keepContent) {
      preambleStartLine = lineIndex;
      return false;
    }

    if (preamble.length === 0) {
      preambleStartLine = lineIndex;
    }
    preamble.push(line);
    return false;
  }

  function finish(): ChapterSplitResult {
    if (finished && result) {
      return result;
    }

    if (currentChapter) {
      chapters.push(currentChapter);
      currentChapter = null;
    }

    if (matchedCount === 0 && preambleHasContent) {
      chapters.push({
        title: FALLBACK_CHAPTER_TITLE,
        paragraphs: keepContent ? preamble : [],
      });
      refs.push({
        title: FALLBACK_CHAPTER_TITLE,
        startLine: preambleStartLine,
      });
      preamble = [];
    }

    finished = true;
    result = {
      chapters,
      refs,
      matchedCount,
      lineCount,
    };

    return result;
  }

  return { push, finish };
}

export function splitChapters(
  lines: Iterable<string>,
  regex: RegExp,
  options: ChapterSplitOptions = {}
): ChapterSplitResult {
  const splitter = createChapterSplitter(regex, options);

  for (const line of lines) {
    splitter.push(line);
  }

  return splitter.finish();
}
