import type { BookMeta } from "../book";
import { buildNavDocument, buildNcxDocument } from "./documents";
import type { NavItem } from "./documents";
import {
  CONTAINER_PATH,
  CONTENT_OPF_PATH,
  EPUB_MIMETYPE,
  MIMETYPE_PATH,
  NAV_PATH,
  NCX_PATH,
  STYLE_PATH,
  buildContainerDocument,
  buildContentOpf,
} from "./package";
import type { ExtraMetadata, ManifestItem } from "./package";
import type { EpubEntry } from "./types";

export interface EpubScaffoldInput {
  meta: BookMeta;
  identifier: string;
  modifiedAt: string;
  manifest: ManifestItem[];
  spine: string[];
  navItems: NavItem[];
  styleSheet: string;
  extraMetadata?: ExtraMetadata[];
}

/**
 * 生成所有 EPUB 共用的固定文件序列：
 * mimetype → container.xml → content.opf → nav.xhtml → toc.ncx → style.css。
 */
export function buildEpubScaffold(input: EpubScaffoldInput): EpubEntry[] {
  return [
    {
      path: MIMETYPE_PATH,
      data: EPUB_MIMETYPE,
      compression: "STORE",
    },
    {
      path: CONTAINER_PATH,
      data: buildContainerDocument(),
    },
    {
      path: CONTENT_OPF_PATH,
      data: buildContentOpf({
        meta: input.meta,
        identifier: input.identifier,
        modifiedAt: input.modifiedAt,
        manifest: input.manifest,
        spine: input.spine,
        extraMetadata: input.extraMetadata,
      }),
    },
    {
      path: NAV_PATH,
      data: buildNavDocument({
        title: input.meta.title,
        language: input.meta.language,
        items: input.navItems,
      }),
    },
    {
      path: NCX_PATH,
      data: buildNcxDocument({
        title: input.meta.title,
        identifier: input.identifier,
        items: input.navItems,
      }),
    },
    {
      path: STYLE_PATH,
      data: input.styleSheet,
    },
  ];
}
