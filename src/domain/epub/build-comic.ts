import { DomainError } from "../result";
import { buildComicPageDocument } from "./documents";
import {
  buildComicStyleSheet,
  createBaseManifest,
} from "./package";
import type { ManifestItem } from "./package";
import { buildEpubScaffold } from "./scaffold";
import type { ComicEpubInput, EpubEntry } from "./types";

const OEBPS_PREFIX = "OEBPS";

interface ComicPageBuild {
  index: number;
  imageHref: string;
  pageHref: string;
  mediaType: string;
}

export function buildComicEpub(input: ComicEpubInput): EpubEntry[] {
  if (input.images.length === 0) {
    throw new DomainError("NO_IMAGES", "至少需要一张图片才能生成漫画 EPUB");
  }

  const pages: ComicPageBuild[] = input.images.map((image, index) => {
    const extension = image.extension.toLowerCase();
    const imageName = `image${index}${extension}`;

    return {
      index,
      imageHref: `images/${imageName}`,
      pageHref: `page${index}.xhtml`,
      mediaType: image.mimeType,
    };
  });

  const navItems = pages.map((page) => ({
    href: page.pageHref,
    label: `Page ${page.index + 1}`,
  }));

  const pageManifest: ManifestItem[] = pages.map((page) => ({
    id: `page${page.index}`,
    href: page.pageHref,
    mediaType: "application/xhtml+xml",
  }));

  const imageManifest: ManifestItem[] = pages.map((page) => ({
    id: `img${page.index}`,
    href: page.imageHref,
    mediaType: page.mediaType,
  }));

  const spine = pages.map((page) => `page${page.index}`);

  const entries = buildEpubScaffold({
    meta: input.meta,
    identifier: input.identifier,
    modifiedAt: input.modifiedAt,
    manifest: [...createBaseManifest(), ...pageManifest, ...imageManifest],
    spine,
    navItems,
    styleSheet: buildComicStyleSheet(),
    extraMetadata: [
      { property: "rendition:layout", value: "pre-paginated" },
      { property: "rendition:orientation", value: "auto" },
      { property: "rendition:spread", value: "none" },
    ],
  });

  pages.forEach((page) => {
    entries.push({
      path: `${OEBPS_PREFIX}/${page.pageHref}`,
      data: buildComicPageDocument({
        pageNumber: page.index + 1,
        imageHref: page.imageHref,
        language: input.meta.language,
      }),
    });
  });

  pages.forEach((page, index) => {
    entries.push({
      path: `${OEBPS_PREFIX}/${page.imageHref}`,
      data: input.images[index].data,
    });
  });

  return entries;
}
