import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./download";

function createEnvironment() {
  const anchor = {
    href: "",
    download: "",
    rel: "",
    click: vi.fn(),
    remove: vi.fn(),
  };
  const appendChild = vi.fn();
  const doc = {
    createElement: vi.fn(() => anchor),
    body: { appendChild },
  } as unknown as Document;
  const createObjectUrl = vi.fn(() => "blob:download");
  const revokeObjectUrl = vi.fn();

  return {
    anchor,
    appendChild,
    doc,
    createObjectUrl,
    revokeObjectUrl,
  };
}

describe("downloadBlob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("创建链接、触发点击并释放对象 URL", () => {
    const environment = createEnvironment();
    const blob = new Blob(["epub"]);

    downloadBlob(blob, "我的书.epub", {
      document: environment.doc,
      createObjectUrl: environment.createObjectUrl,
      revokeObjectUrl: environment.revokeObjectUrl,
    });

    expect(environment.createObjectUrl).toHaveBeenCalledWith(blob);
    expect(environment.doc.createElement).toHaveBeenCalledWith("a");
    expect(environment.anchor.href).toBe("blob:download");
    expect(environment.anchor.download).toBe("我的书.epub");
    expect(environment.anchor.rel).toBe("noopener");
    expect(environment.appendChild).toHaveBeenCalledWith(environment.anchor);
    expect(environment.anchor.click).toHaveBeenCalledTimes(1);
    expect(environment.anchor.remove).toHaveBeenCalledTimes(1);
    expect(environment.revokeObjectUrl).toHaveBeenCalledWith("blob:download");
  });

  it("点击抛错时仍会移除链接并释放 URL", () => {
    const environment = createEnvironment();
    environment.anchor.click.mockImplementation(() => {
      throw new Error("click failed");
    });

    expect(() =>
      downloadBlob(new Blob(["x"]), "book.epub", {
        document: environment.doc,
        createObjectUrl: environment.createObjectUrl,
        revokeObjectUrl: environment.revokeObjectUrl,
      })
    ).toThrow("click failed");

    expect(environment.anchor.remove).toHaveBeenCalledTimes(1);
    expect(environment.revokeObjectUrl).toHaveBeenCalledWith("blob:download");
  });

  it("插入链接失败时仍会释放 URL", () => {
    const environment = createEnvironment();
    environment.appendChild.mockImplementation(() => {
      throw new Error("append failed");
    });

    expect(() =>
      downloadBlob(new Blob(["x"]), "book.epub", {
        document: environment.doc,
        createObjectUrl: environment.createObjectUrl,
        revokeObjectUrl: environment.revokeObjectUrl,
      })
    ).toThrow("append failed");

    expect(environment.revokeObjectUrl).toHaveBeenCalledWith("blob:download");
  });

  it("未注入依赖时使用全局 document 和 URL", () => {
    const environment = createEnvironment();
    vi.stubGlobal("document", environment.doc);
    vi.stubGlobal("URL", {
      createObjectURL: environment.createObjectUrl,
      revokeObjectURL: environment.revokeObjectUrl,
    });

    downloadBlob(new Blob(["epub"]), "global.epub");

    expect(environment.createObjectUrl).toHaveBeenCalledTimes(1);
    expect(environment.anchor.href).toBe("blob:download");
    expect(environment.revokeObjectUrl).toHaveBeenCalledWith("blob:download");
  });

  it("document.body 不可用时直接报错", () => {
    const environment = createEnvironment();
    const doc = {
      createElement: vi.fn(),
      body: null,
    } as unknown as Document;

    expect(() =>
      downloadBlob(new Blob(["x"]), "book.epub", {
        document: doc,
        createObjectUrl: environment.createObjectUrl,
        revokeObjectUrl: environment.revokeObjectUrl,
      })
    ).toThrow("document.body 不可用");
    expect(environment.createObjectUrl).not.toHaveBeenCalled();
  });
});
