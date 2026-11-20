export const EncodingList = [
  "utf-8",
  "utf-16le",
  "utf-16be",
  "gbk",
  "gb18030",
  "big5",
  "shift_jis",
  "euc-jp",
  "euc-kr",
  "iso-2022-jp",
  "iso-8859-1",
  "iso-8859-2",
  "iso-8859-5",
  "iso-8859-6",
  "iso-8859-7",
  "iso-8859-8",
  "iso-8859-9",
  "windows-1250",
  "windows-1251",
  "windows-1252",
  "windows-1253",
  "windows-1254",
  "windows-1255",
  "windows-1256",
  "koi8-r",
] as const;

export type TextEncoding = (typeof EncodingList)[number];

export const DEFAULT_ENCODING: TextEncoding = "utf-8";

const EncodingAliasMap: Record<string, TextEncoding> = {
  ascii: "utf-8",
  "us-ascii": "utf-8",
  utf8: "utf-8",
  "utf-8": "utf-8",
  utf16: "utf-16le",
  "utf-16": "utf-16le",
  utf16le: "utf-16le",
  "utf-16le": "utf-16le",
  utf16be: "utf-16be",
  "utf-16be": "utf-16be",
  gb2312: "gbk",
  gbk: "gbk",
  latin1: "iso-8859-1",
  cp1250: "windows-1250",
  cp1251: "windows-1251",
  cp1252: "windows-1252",
  gb18030: "gb18030",
  cp936: "gbk",
  big5: "big5",
  shift_jis: "shift_jis",
  sjis: "shift_jis",
  eucjp: "euc-jp",
  "euc-jp": "euc-jp",
  euckr: "euc-kr",
  "euc-kr": "euc-kr",
  "iso-2022-jp": "iso-2022-jp",
};

export function isSupportedEncoding(name: string): name is TextEncoding {
  return (EncodingList as readonly string[]).includes(name);
}

export function normalizeEncodingName(raw: string): TextEncoding | undefined {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!normalized) {
    return undefined;
  }

  const candidate = EncodingAliasMap[normalized] ?? normalized;
  if (!isSupportedEncoding(candidate)) {
    return undefined;
  }

  try {
    new TextDecoder(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}
