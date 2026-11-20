import { describe, expect, it } from "vitest";
import {
  EncodingList,
  isSupportedEncoding,
  normalizeEncodingName,
} from "./encoding";

describe("normalizeEncodingName", () => {
  it("接受所有 EncodingList 中的编码", () => {
    for (const encoding of EncodingList) {
      expect(normalizeEncodingName(encoding)).toBe(encoding);
    }
  });

  it("归一化常见别名", () => {
    expect(normalizeEncodingName("UTF-8")).toBe("utf-8");
    expect(normalizeEncodingName("utf8")).toBe("utf-8");
    expect(normalizeEncodingName(" GB2312 ")).toBe("gbk");
    expect(normalizeEncodingName("cp936")).toBe("gbk");
    expect(normalizeEncodingName("ASCII")).toBe("utf-8");
    expect(normalizeEncodingName("us-ascii")).toBe("utf-8");
    expect(normalizeEncodingName("latin1")).toBe("iso-8859-1");
    expect(normalizeEncodingName("cp1252")).toBe("windows-1252");
    expect(normalizeEncodingName("UTF-16")).toBe("utf-16le");
    expect(normalizeEncodingName("utf16be")).toBe("utf-16be");
    expect(normalizeEncodingName("Shift_JIS")).toBe("shift_jis");
    expect(normalizeEncodingName("sjis")).toBe("shift_jis");
    expect(normalizeEncodingName("eucjp")).toBe("euc-jp");
    expect(normalizeEncodingName("euckr")).toBe("euc-kr");
  });

  it("忽略大小写和内部空白", () => {
    expect(normalizeEncodingName("  UtF  8  ")).toBe("utf-8");
    expect(normalizeEncodingName("  WINDOWS-1252  ")).toBe("windows-1252");
  });

  it("拒绝空值和未知编码", () => {
    expect(normalizeEncodingName("")).toBeUndefined();
    expect(normalizeEncodingName("   ")).toBeUndefined();
    expect(normalizeEncodingName("utf-32")).toBeUndefined();
    expect(normalizeEncodingName("not-an-encoding")).toBeUndefined();
  });
});

describe("isSupportedEncoding", () => {
  it("只接受编码列表中的精确值", () => {
    expect(isSupportedEncoding("utf-8")).toBe(true);
    expect(isSupportedEncoding("gbk")).toBe(true);
    expect(isSupportedEncoding("UTF-8")).toBe(false);
    expect(isSupportedEncoding("utf8")).toBe(false);
    expect(isSupportedEncoding("utf-32")).toBe(false);
  });
});
