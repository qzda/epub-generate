import { DomainError } from "../result";
import { buildTocItems, buildTextChapterDocument } from "./documents";
import {
  buildTextStyleSheet,
  createBaseManifest,
} from "./package";
import type { ManifestItem } from "./package";
import { buildEpubScaffold } from "./scaffold";
import type { EpubEntry, TextEpubInput } from "./types";

const OEBPS_PREFIX = "OEBPS";

export function buildTextEpub(input: TextEpubInput): EpubEntry[] {
  if (input.chapters.length === 0) {
    throw new DomainError("NO_CHAPTERS", "至少需要一个章节才能生成 EPUB");
  }

  const tocItems = buildTocItems(
    input.chapters,
    (index) => `chapter${index}.xhtml`
  );

  const chapterManifest: ManifestItem[] = input.chapters.map((_, index) => ({
    id: `chapter${index}`,
    href: `chapter${index}.xhtml`,
    mediaType: "application/xhtml+xml",
  }));

  const spine = input.chapters.map((_, index) => `chapter${index}`);

  const entries = buildEpubScaffold({
    meta: input.meta,
    identifier: input.identifier,
    modifiedAt: input.modifiedAt,
    manifest: [...createBaseManifest(), ...chapterManifest],
    spine,
    navItems: tocItems,
    styleSheet: buildTextStyleSheet(),
  });

  input.chapters.forEach((chapter, index) => {
    entries.push({
      path: `${OEBPS_PREFIX}/chapter${index}.xhtml`,
      data: buildTextChapterDocument({
        chapter,
        language: input.meta.language,
      }),
    });
  });

  return entries;
}
