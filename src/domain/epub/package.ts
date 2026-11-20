import type { BookMeta } from "../book";
import { escapeXml } from "./xml";

export const EPUB_MIMETYPE = "application/epub+zip";
export const MIMETYPE_PATH = "mimetype";
export const CONTAINER_PATH = "META-INF/container.xml";
export const CONTENT_OPF_PATH = "OEBPS/content.opf";
export const NAV_PATH = "OEBPS/nav.xhtml";
export const NCX_PATH = "OEBPS/toc.ncx";
export const STYLE_PATH = "OEBPS/style.css";

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string[];
}

export interface ExtraMetadata {
  property: string;
  value: string;
}

export interface ContentOpfInput {
  meta: BookMeta;
  identifier: string;
  modifiedAt: string;
  manifest: ManifestItem[];
  spine: string[];
  extraMetadata?: ExtraMetadata[];
}

export function buildContainerDocument(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${CONTENT_OPF_PATH}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

export function buildContentOpf(input: ContentOpfInput): string {
  const manifestItems = input.manifest
    .map((item) => {
      const properties = item.properties?.length
        ? ` properties="${escapeXml(item.properties.join(" "))}"`
        : "";
      return `    <item id="${escapeXml(item.id)}" href="${escapeXml(item.href)}" media-type="${escapeXml(item.mediaType)}"${properties}/>`;
    })
    .join("\n");

  const spineItems = input.spine
    .map((idref) => `    <itemref idref="${escapeXml(idref)}"/>`)
    .join("\n");

  const extraMetadata = (input.extraMetadata ?? [])
    .map(
      (meta) =>
        `    <meta property="${escapeXml(meta.property)}">${escapeXml(meta.value)}</meta>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(input.meta.title)}</dc:title>
    <dc:creator>${escapeXml(input.meta.author)}</dc:creator>
    <dc:language>${escapeXml(input.meta.language)}</dc:language>
    <dc:identifier id="BookId">${escapeXml(input.identifier)}</dc:identifier>
    <meta property="dcterms:modified">${escapeXml(input.modifiedAt)}</meta>
${extraMetadata}
  </metadata>
  <manifest>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;
}

export function createBaseManifest(): ManifestItem[] {
  return [
    {
      id: "nav",
      href: "nav.xhtml",
      mediaType: "application/xhtml+xml",
      properties: ["nav"],
    },
    {
      id: "ncx",
      href: "toc.ncx",
      mediaType: "application/x-dtbncx+xml",
    },
    {
      id: "style",
      href: "style.css",
      mediaType: "text/css",
    },
  ];
}

export function buildTextStyleSheet(): string {
  return `body {
  font-family: "Noto Serif SC", "SimSun", serif;
  line-height: 1.8;
  margin: 2em;
}
h1 {
  text-align: center;
  font-size: 1.5em;
  margin: 2em 0 1em 0;
}
p {
  text-indent: 2em;
  margin: 0.5em 0;
}`;
}

export function buildComicStyleSheet(): string {
  return `body {
  margin: 0;
  padding: 0;
  text-align: center;
}
img {
  max-width: 100%;
  max-height: 100vh;
  margin: 0 auto;
  display: block;
}`;
}
