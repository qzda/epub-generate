import { DomainError, fail, ok } from "./result";
import type { AppError, Result } from "./result";

export const MAX_CHAPTER_DEPTH = 3;

export interface Chapter {
  title: string;
  paragraphs: string[];
  /** 标题层级，1 为最外层。缺省视为 1。 */
  level?: number;
}

export interface ChapterRef {
  title: string;
  startLine: number;
  /** 标题层级，1 为最外层。缺省视为 1。 */
  level?: number;
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

export type ChapterPatternInput = RegExp | ReadonlyArray<RegExp>;

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

/**
 * 编译多级标题正则：每行一条，从一级到三级，空行会被忽略。
 */
export function compileChapterPatterns(
  source: string
): Result<RegExp[], AppError> {
  const sources = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (sources.length === 0) {
    return fail({
      code: "INVALID_PATTERN",
      message: "章节正则不能为空",
    });
  }

  if (sources.length > MAX_CHAPTER_DEPTH) {
    return fail({
      code: "INVALID_PATTERN",
      message: `最多支持 ${MAX_CHAPTER_DEPTH} 级标题正则`,
    });
  }

  const patterns: RegExp[] = [];

  for (let index = 0; index < sources.length; index += 1) {
    const patternSource = sources[index];
    try {
      patterns.push(new RegExp(patternSource));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return fail({
        code: "INVALID_PATTERN",
        message: `第 ${index + 1} 级标题正则无效：${detail}`,
      });
    }
  }

  return ok(patterns);
}

/**
 * 把标题的原始层级归一化为从 1 开始、且每次最多下探一级的连续层级。
 * 例如只有二级标题时，会整体提升为一级：`[2, 2, 2] -> [1, 1, 1]`。
 */
export function normalizeChapterLevels(
  levels: ReadonlyArray<number | undefined>
): number[] {
  if (levels.length === 0) {
    return [];
  }

  const sanitized = levels.map(toLevel);
  let base = sanitized[0];

  for (const level of sanitized) {
    if (level < base) {
      base = level;
    }
  }

  const stack: Array<{ raw: number; effective: number }> = [];

  return sanitized.map((level) => {
    const raw = level - base + 1;

    while (stack.length > 0 && stack[stack.length - 1].raw >= raw) {
      stack.pop();
    }

    const effective =
      stack.length === 0
        ? 1
        : Math.min(
            stack[stack.length - 1].effective + 1,
            MAX_CHAPTER_DEPTH
          );

    stack.push({ raw, effective });
    return effective;
  });
}

function toLevel(level: number | undefined): number {
  return typeof level === "number" && Number.isFinite(level)
    ? Math.min(MAX_CHAPTER_DEPTH, Math.max(1, Math.floor(level)))
    : 1;
}

function createMatchers(input: ChapterPatternInput): RegExp[] {
  const patterns = input instanceof RegExp ? [input] : [...input];

  if (patterns.length === 0) {
    throw new DomainError("INVALID_PATTERN", "至少需要一个章节正则");
  }

  if (patterns.length > MAX_CHAPTER_DEPTH) {
    throw new DomainError(
      "INVALID_PATTERN",
      `最多支持 ${MAX_CHAPTER_DEPTH} 级标题正则`
    );
  }

  return patterns.map(
    (regex) => new RegExp(regex.source, regex.flags.replace(/[gy]/g, ""))
  );
}

export function createChapterSplitter(
  patterns: ChapterPatternInput,
  options: ChapterSplitOptions = {}
): ChapterSplitter {
  const keepContent = options.keepContent ?? true;
  const matchers = createMatchers(patterns);

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

  function detectLevel(line: string): number {
    for (let index = 0; index < matchers.length; index += 1) {
      if (matchers[index].test(line)) {
        return index + 1;
      }
    }

    return 0;
  }

  function push(line: string): boolean {
    if (finished) {
      throw new DomainError("INVALID_PATTERN", "分章器已经结束，不能继续写入");
    }

    const lineIndex = lineCount;
    lineCount += 1;
    const level = detectLevel(line);

    if (level > 0) {
      matchedCount += 1;

      if (currentChapter) {
        chapters.push(currentChapter);
      } else if (preambleHasContent) {
        chapters.push({
          title: PREAMBLE_TITLE,
          paragraphs: keepContent ? preamble : [],
          level: 1,
        });
        refs.push({
          title: PREAMBLE_TITLE,
          startLine: preambleStartLine,
          level: 1,
        });
        preamble = [];
      }

      currentChapter = {
        title: line.trim(),
        paragraphs: [],
        level,
      };
      refs.push({
        title: currentChapter.title,
        startLine: lineIndex,
        level,
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

    if (!preambleHasContent) {
      preambleStartLine = lineIndex;
    }
    preambleHasContent = true;

    if (!keepContent) {
      return false;
    }

    preamble.push(line);
    return false;
  }

  function normalizeLevels(): void {
    const realRefs = refs.filter(
      (ref) =>
        ref.title !== PREAMBLE_TITLE && ref.title !== FALLBACK_CHAPTER_TITLE
    );
    const realLevels = normalizeChapterLevels(
      realRefs.map((ref) => ref.level)
    );
    let realIndex = 0;

    refs.forEach((ref) => {
      if (
        ref.title === PREAMBLE_TITLE ||
        ref.title === FALLBACK_CHAPTER_TITLE
      ) {
        ref.level = 1;
        return;
      }

      ref.level = realLevels[realIndex] ?? 1;
      realIndex += 1;
    });

    chapters.forEach((chapter, index) => {
      const ref = refs[index];
      if (ref) {
        chapter.level = ref.level;
      }
    });
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
        level: 1,
      });
      refs.push({
        title: FALLBACK_CHAPTER_TITLE,
        startLine: preambleStartLine,
        level: 1,
      });
      preamble = [];
    }

    normalizeLevels();

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
  patterns: ChapterPatternInput,
  options: ChapterSplitOptions = {}
): ChapterSplitResult {
  const splitter = createChapterSplitter(patterns, options);

  for (const line of lines) {
    splitter.push(line);
  }

  return splitter.finish();
}
