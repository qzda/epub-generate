import type { BookMeta } from "../book";
import type { Chapter } from "../chapter";
import type { ComicImage } from "../comic";

export type EpubEntryCompression = "STORE";

export interface EpubEntry {
  path: string;
  data: string | Uint8Array;
  compression?: EpubEntryCompression;
}

export interface EpubBuildContext {
  meta: BookMeta;
  identifier: string;
  modifiedAt: string;
}

export interface TextEpubInput extends EpubBuildContext {
  chapters: Chapter[];
}

export interface ComicImageData extends ComicImage {
  data: Uint8Array;
}

export interface ComicEpubInput extends EpubBuildContext {
  images: ComicImageData[];
}
