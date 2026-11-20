export interface BookMeta {
  title: string;
  author: string;
  language: string;
}

export interface BookMetaInput {
  title?: string;
  author?: string;
  language?: string;
}

export const FALLBACK_BOOK_TITLE = "未命名书籍";
export const FALLBACK_BOOK_AUTHOR = "未知作者";
export const DEFAULT_LANGUAGE = "zh";
export const FALLBACK_FILE_NAME = "book";

export function createBookMeta(input: BookMetaInput = {}): BookMeta {
  return {
    title: input.title?.trim() || FALLBACK_BOOK_TITLE,
    author: input.author?.trim() || FALLBACK_BOOK_AUTHOR,
    language: input.language?.trim() || DEFAULT_LANGUAGE,
  };
}

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const codeUnit = char.charCodeAt(0);
      return codeUnit > 0x1f && codeUnit !== 0x7f;
    })
    .join("");
}

export function sanitizeEpubFileName(name: string): string {
  const withoutEpub = name.trim().replace(/\.epub$/i, "");
  const sanitized = stripControlCharacters(withoutEpub)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "")
    .trim();

  if (!sanitized || /^[_ .]+$/.test(sanitized)) {
    return `${FALLBACK_FILE_NAME}.epub`;
  }

  return `${sanitized}.epub`;
}
