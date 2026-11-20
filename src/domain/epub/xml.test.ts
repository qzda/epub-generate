import { describe, expect, it } from "vitest";
import { escapeXml } from "./xml";

describe("escapeXml", () => {
  it("转义五个 XML 特殊字符", () => {
    expect(escapeXml("&<>\"'")).toBe("&amp;&lt;&gt;&quot;&apos;");
  });

  it("优先转义 &，避免双重解码", () => {
    expect(escapeXml("&lt;")).toBe("&amp;lt;");
    expect(escapeXml("a & b")).toBe("a &amp; b");
  });

  it("保留普通文本和 Unicode", () => {
    expect(escapeXml("第一章 开始")).toBe("第一章 开始");
    expect(escapeXml("emoji 🚀")).toBe("emoji 🚀");
  });

  it("空字符串安全", () => {
    expect(escapeXml("")).toBe("");
  });
});
