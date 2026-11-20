import { describe, expect, it } from "vitest";
import {
  collectComicImages,
  compareComicPaths,
  getBaseName,
  getImageExtension,
  getImageMimeType,
  isDirectoryPath,
  isImagePath,
  orderImageEntries,
} from "./comic";

describe("getBaseName", () => {
  it("支持正斜杠和反斜杠路径", () => {
    expect(getBaseName("images/01.jpg")).toBe("01.jpg");
    expect(getBaseName("images\\01.jpg")).toBe("01.jpg");
    expect(getBaseName("01.jpg")).toBe("01.jpg");
    expect(getBaseName("images/sub/")).toBe("sub");
  });
});

describe("isDirectoryPath", () => {
  it("识别以分隔符结尾的目录路径", () => {
    expect(isDirectoryPath("images/")).toBe(true);
    expect(isDirectoryPath("images\\")).toBe(true);
    expect(isDirectoryPath("images/01.jpg")).toBe(false);
  });
});

describe("图片格式识别", () => {
  it("返回小写扩展名", () => {
    expect(getImageExtension("A.JPG")).toBe(".jpg");
    expect(getImageExtension("a.jpeg")).toBe(".jpeg");
    expect(getImageExtension("a.PNG")).toBe(".png");
    expect(getImageExtension("a.webp")).toBe(".webp");
    expect(getImageExtension("a.bmp")).toBe(".bmp");
  });

  it("拒绝目录、无扩展名和未知格式", () => {
    expect(getImageExtension("images/")).toBeUndefined();
    expect(getImageExtension("README")).toBeUndefined();
    expect(getImageExtension(".jpg")).toBeUndefined();
    expect(getImageExtension("a.svg")).toBeUndefined();
    expect(getImageExtension("a.txt")).toBeUndefined();
  });

  it("映射 MIME 类型", () => {
    expect(getImageMimeType("a.jpg")).toBe("image/jpeg");
    expect(getImageMimeType("a.jpeg")).toBe("image/jpeg");
    expect(getImageMimeType("a.png")).toBe("image/png");
    expect(getImageMimeType("a.gif")).toBe("image/gif");
    expect(getImageMimeType("a.webp")).toBe("image/webp");
    expect(getImageMimeType("a.bmp")).toBe("image/bmp");
    expect(getImageMimeType("a.txt")).toBeUndefined();
  });

  it("isImagePath 同时排除目录和非图片", () => {
    expect(isImagePath("a.jpg")).toBe(true);
    expect(isImagePath("images/")).toBe(false);
    expect(isImagePath("a.txt")).toBe(false);
  });
});

describe("orderImageEntries", () => {
  it("按文件名自然序排序，而不是字典序", () => {
    const result = orderImageEntries([
      "10.jpg",
      "2.jpg",
      "1.jpg",
      "01.jpg",
    ]);

    expect(result.slice(0, 2)).toEqual(["1.jpg", "01.jpg"]);
    expect(result.slice(2)).toEqual(["2.jpg", "10.jpg"]);
  });

  it("过滤目录和非图片文件", () => {
    expect(
      orderImageEntries(["images/", "a.txt", "2.png", "1.png"])
    ).toEqual(["1.png", "2.png"]);
  });

  it("文件名相同时回退到完整路径比较", () => {
    const result = orderImageEntries([
      "b/chapter/1.jpg",
      "a/chapter/1.jpg",
    ]);

    expect(result).toEqual(["a/chapter/1.jpg", "b/chapter/1.jpg"]);
  });

  it("大小写不敏感地比较文件名", () => {
    expect(compareComicPaths("A.jpg", "a.jpg")).toBe(0);
  });
});

describe("collectComicImages", () => {
  it("返回排序后的图片信息", () => {
    const result = collectComicImages([
      "pages/10.JPG",
      "pages/2.png",
      "pages/",
      "notes.txt",
    ]);

    expect(result).toEqual([
      {
        path: "pages/2.png",
        baseName: "2.png",
        extension: ".png",
        mimeType: "image/png",
      },
      {
        path: "pages/10.JPG",
        baseName: "10.JPG",
        extension: ".jpg",
        mimeType: "image/jpeg",
      },
    ]);
  });

  it("空输入返回空数组", () => {
    expect(collectComicImages([])).toEqual([]);
  });
});
