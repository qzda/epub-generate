import chardet from "chardet";

export const EncodingList = [
  "UTF-8",
  "UTF-16 LE",
  "UTF-16 BE",
  "UTF-32 LE",
  "UTF-32 BE",
  "ISO-2022-JP",
  "ISO-2022-KR",
  "ISO-2022-CN",
  "Shift_JIS",
  "Big5",
  "EUC-JP",
  "EUC-KR",
  "GB18030",
  "ISO-8859-1",
  "ISO-8859-2",
  "ISO-8859-5",
  "ISO-8859-6",
  "ISO-8859-7",
  "ISO-8859-8",
  "ISO-8859-9",
  "windows-1250",
  "windows-1251",
  "windows-1252",
  "windows-1253",
  "windows-1254",
  "windows-1255",
  "windows-1256",
  "KOI8-R",
];

export async function detectTextFileEncoding(file: File) {
  const buffer = await file.slice(0, 64 * 1024).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // chardet 检测
  const encoding = chardet.detect(bytes);

  return encoding;
}
