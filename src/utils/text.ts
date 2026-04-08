import chardet from "chardet";

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
];

const EncodingAliasMap: Record<string, string> = {
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

function normalizeEncodingName(encoding: string): string | undefined {
  const normalized = encoding.trim().toLowerCase().replace(/\s+/g, "");
  const mapped = EncodingAliasMap[normalized] || encoding.trim().toLowerCase();

  if (!EncodingList.includes(mapped)) {
    return undefined;
  }

  try {
    new TextDecoder(mapped);
    return mapped;
  } catch {
    return undefined;
  }
}

export async function detectTextFileEncoding(file: File) {
  const buffer = await file.slice(0, 64 * 1024).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // chardet 检测
  const encoding = chardet.detect(bytes);
  if (!encoding) {
    return undefined;
  }

  return normalizeEncodingName(encoding);
}
