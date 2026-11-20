# Epub Generate 重写计划

> 状态：计划已定稿，尚未开始实施
> 最后更新：2026-11-20
> 关联文档：[AGENTS.md](../AGENTS.md)

## 1. 背景

Epub Generate 是纯静态 Vue 3 应用，由 Netlify 托管。用户有两种使用路径：

- 文本模式：上传 TXT/MD，自动检测编码，按正则匹配标题切分章节，填写书籍信息，生成 EPUB。
- 漫画模式：上传图片 ZIP，按文件名自然序排列，一张图片一页，填写书籍信息，生成固定版式 EPUB。

现有实现不作为标准。本次目标不是局部修补，而是按分层架构重写核心逻辑，并补齐纯函数测试。

## 2. 目标

- 领域逻辑与浏览器 IO、Vue、第三方库解耦，全部可单测。
- EPUB 产物确定、结构正确，兼容主流阅读器。
- 预览、目录与最终产物使用同一套分章/排序规则，不再出现数量不一致。
- 错误、进度、拖拽上传等体验补齐，不使用 `alert`。
- 所有文件只在浏览器本地处理，不上传、不记录内容。
- 依赖优先使用成熟 npm 包，但新增依赖必须经用户确认。

## 3. 已确认决策

| 决策项 | 结论 | 确认日期 |
| --- | --- | --- |
| EPUB 标准 | EPUB 3 + NCX 兼容，始终生成 `nav.xhtml`，保留 `toc.ncx` 与 `spine toc` | 2026-11-20 |
| Markdown | 按纯文本处理，章节完全由正则决定，不额外解析 Markdown 语法 | 2026-11-20 |
| 界面结构 | 单页工作台，拆分为组件，不做多步向导 | 2026-11-20 |
| 测试范围 | 领域层 + 服务层；暂不做组件测试 | 2026-11-20 |
| ZIP 库 | 使用 `fflate` 替换 `jszip` | 2026-11-20 |
| UI 工具库 | 引入 `@vueuse/core`，只按需导入 | 2026-11-20 |
| EPUB 生成 | 保留自研纯函数 builder，不引入 `epub-gen-memory` | 2026-11-20 |
| 覆盖率工具 | 引入 `@vitest/coverage-v8`（devDependency） | 2026-11-20 |
| 非目标 | 封面、多级目录、Markdown 渲染、Web Worker 打包、额外出版元数据 | 2026-11-20 |

## 4. 现有实现的主要问题

| 问题 | 位置 | 影响 |
| --- | --- | --- |
| UI、文件 IO、状态、EPUB 生成集中在一个组件 | `src/App.vue` | 无法单测，改动互相牵连 |
| 文本/漫画两套生成逻辑大量重复 | `src/utils/epub.ts` | 修一处漏一处 |
| 生成函数内部直接操作 `alert`、DOM、`URL` | `src/utils/epub.ts` | 无法测试，副作用难控 |
| 目录只扫描预览前 200 行，生成却读全文 | `src/App.vue` | 预览章数与实际产物不一致 |
| 无章节匹配时不生成 `nav.xhtml` | `src/utils/epub.ts` | 不符合 EPUB 3 导航文档要求 |
| 异常只 `console.error` 或 `alert` | `src/App.vue` | 用户反馈不稳定，失败路径不可测 |
| 编码检测失败静默回退 UTF-8 | `src/App.vue` | 乱码风险且无提示 |
| 行读取只按 `\n` 切分 | `src/utils/file.ts` | 不兼容单独 `\r` 换行 |
| 漫画排序与预览逻辑重复 | `src/App.vue`、`src/utils/epub.ts` | 预览与产物可能顺序不一致 |
| 文案支持拖拽但未实现 | `src/App.vue` | 体验与承诺不符 |
| 文本模式可能生成 `xx.epub.epub` | `src/utils/epub.ts` | 文件名错误 |
| 无测试 | — | 重构没有安全网 |

## 5. 目标架构

原则：`domain/` 不 import Vue、JSZip/fflate、chardet、DOM；浏览器能力收口到 `services/`；组件只负责展示与触发。

```text
src/
├─ domain/                     # 纯函数，可在 Node 中测试
│  ├─ result.ts                # Result<T, AppError>、错误码
│  ├─ book.ts                  # BookMeta 校验、默认值、文件名清洗
│  ├─ chapter.ts               # 正则编译、流式分章器、章节索引
│  ├─ encoding.ts              # EncodingList、别名归一化、可用性校验
│  ├─ comic.ts                 # 图片识别、自然序排序、页面模型
│  └─ epub/
│     ├─ types.ts              # EpubEntry / EpubBookInput
│     ├─ xml.ts                # escapeXml
│     ├─ documents.ts          # 章节页、漫画页、nav.xhtml、toc.ncx
│     ├─ package.ts            # content.opf、container.xml、style.css
│     ├─ build-text.ts         # buildTextEpub(meta, chapters, id, modifiedAt)
│     └─ build-comic.ts        # buildComicEpub(meta, pages, id, modifiedAt)
├─ services/                   # 浏览器 IO，薄适配层
│  ├─ line-reader.ts           # File + 编码 → 异步行流
│  ├─ encoding-detect.ts       # chardet 适配，返回检测结果与回退标记
│  ├─ text-source.ts           # 全文扫描：预览行、章节索引、总行数
│  ├─ comic-source.ts          # 读取 ZIP、图片清单、预览 URL、清理
│  ├─ epub-pack.ts             # EpubEntry[] → Blob（fflate）
│  └─ download.ts              # Blob 下载与 URL 释放
├─ composables/
│  ├─ useTextSource.ts         # 扫描、正则防抖、取消
│  ├─ useComicSource.ts        # ZIP 预览与清理
│  ├─ useExport.ts             # 生成阶段、进度、错误
│  └─ useMessages.ts           # 替代 alert 的状态消息
├─ components/
│  ├─ SourceDropzone.vue       # 点击、拖拽、键盘操作
│  ├─ BookMetaForm.vue
│  ├─ TextWorkspace.vue        # 编码、正则、完整目录、预览
│  ├─ ComicWorkspace.vue       # 图片预览网格
│  ├─ ExportBar.vue            # 生成按钮 + 原生 progress
│  └─ AppNotice.vue            # aria-live 消息
├─ config/limits.ts            # 文件大小、预览条数、分块大小
├─ test/fixtures.ts            # 编码字节、测试 ZIP 生成器
└─ App.vue                     # 只做布局与组合
```

## 6. 领域模型与纯函数

```ts
interface BookMeta {
  title: string;
  author: string;
  language: string; // 默认 zh
}

interface Chapter {
  title: string;
  paragraphs: string[]; // 只保留非空行，内容不 trim
}

interface ChapterRef {
  title: string;
  startLine: number;
}

type EpubEntry = {
  path: string; // 例如 OEBPS/chapter0.xhtml
  data: string | Uint8Array;
  compression?: "STORE"; // 仅 mimetype 使用
};

type AppErrorCode =
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE"
  | "INVALID_ENCODING"
  | "INVALID_PATTERN"
  | "EMPTY_ARCHIVE"
  | "NO_IMAGES"
  | "PACK_FAILED";
```

核心函数：

- `compileChapterPattern(source): Result<RegExp, AppError>`
  - 处理空串、语法错误、带 `g`/`y` 的 `lastIndex` 污染。
- `createChapterSplitter(regex, { keepContent })`
  - 流式 reducer：`push(line)` / `finish()`。
  - 标题行不进入正文；首个标题前的非空内容记为「前言」；连续标题保留空章节；零匹配时生成单章「正文」。
- `orderImageEntries(paths): string[]`
  - 先按 basename 自然序（`Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" })`），再按完整路径。
- `normalizeEncodingName(raw)` / `isSupportedEncoding(name)`
- `sanitizeEpubFileName(name): string`
- `buildTextEpub` / `buildComicEpub`
  - 接收注入的 `id` 和 `modifiedAt`，输出确定性的 `EpubEntry[]`。
  - 固定顺序：`mimetype`（STORE）→ `META-INF/container.xml` → `OEBPS/content.opf` → `nav.xhtml` → `toc.ncx` → `style.css` → 章节/页面。
  - 所有用户文本经过 `escapeXml`。
  - 无论是否有章节都生成 `nav.xhtml`。

## 7. 服务层

- `readFileLines(file, encoding, { chunkSize, signal })`
  - 单个 `TextDecoder`，`decode(chunk, { stream: true })`，末尾 flush。
  - 支持 `\r\n`、`\n`、单独 `\r`。
- `scanTextSource(file, encoding, regex, { previewLines, signal })`
  - 一次全文流式扫描，同时产出前 200 行预览、完整章节索引、总行数、匹配数。
  - 正则变化防抖 250ms，并用 `AbortSignal` 取消旧任务。
- `readComicSource(file, { previewLimit, signal })`
  - 校验 ZIP 签名（`PK\x03\x04`），过滤目录和非图片。
  - 返回图片清单、前 20 张预览 blob URL 和 `dispose()`。
- `packEpub(entries, { onProgress, signal })`
  - 唯一接触 `fflate` 的地方。
  - 固定 `mtime`，保证相同输入产物稳定。
- `downloadBlob(blob, fileName)`
  - `<a download>` + `URL.revokeObjectURL`，放在 `try/finally`。

错误统一使用 `AppError`（带 `cause`）；用户输入校验在领域层用 `Result` 返回，UI 不再出现 `alert`。

## 8. UI 规划

保留现有 UnoCSS 视觉语言与单页工作台布局：

```text
App.vue
├─ 顶部：SourceDropzone + 生成按钮
├─ 左侧：BookMetaForm +（文本）编码选择 / 章节正则
└─ 右侧：TextWorkspace（预览 + 完整目录）或 ComicWorkspace（图片网格）
```

体验要求：

- 支持拖拽上传，同时保留文件选择框和键盘操作。
- 编码检测失败时明确提示「已回退 UTF-8」。
- 文本目录显示全文匹配结果。
- 生成进度：读取 0–60%、构建 60–70%、压缩 70–95%、下载 100%。
- 使用原生 `<progress>`，配 `aria-label`；完成时用 `role="status"` 播报。
- 错误显示在表单附近或顶部 `aria-live` 区域。

## 9. 依赖决策

### 已批准

| 包 | 类型 | 用途 | 版本 | 周下载 | gzip 体积 |
| --- | --- | --- | --- | ---: | ---: |
| `fflate` | runtime | ZIP 打包/解包，替换 `jszip` | 0.8.3 | 169,012,376 | 11.9 KB |
| `@vueuse/core` | runtime | 拖拽、文件选择、对象 URL、防抖 | 15.0.0 | 20,160,453 | 46.9 KB（按需更小） |
| `@vitest/coverage-v8` | dev | 覆盖率统计 | 5.1.1 | 66,209,237 | — |

依赖变化：

- 新增运行时：`fflate`、`@vueuse/core`
- 移除运行时：`jszip`
- 新增开发依赖：`@vitest/coverage-v8`
- 保留：`vue`、`chardet`

### 评估后不采用

| 包 | 周下载 | gzip 体积 | 不采用原因 |
| --- | ---: | ---: | --- |
| `epub-gen-memory` | 238,261 | 55.3 KB + 12 个依赖 | 面向 HTML + 远程图片，漫画固定版式适配差；维护节奏慢；结构不可精确测试 |
| `file-type` | 83,396,122 | 19.5 KB | ZIP 签名 + 扩展名校验足够，后续确有需要再加 |
| `@zip.js/zip.js` | 8,886,953 | 89.9 KB | 当前 50MB 上限不需要真正流式/ZIP64 |
| `xmlbuilder2` | 18,719,326 | 58.4 KB | XML 模板 + `escapeXml` 更轻、更易测试 |
| `zod` | 475,873,286 | 86.8 KB | 字段很少，手写校验足够 |
| `valibot` | 35,812,700 | 14.4 KB | 若改用 schema 校验优先选它，但当前非必要 |
| `pinia` | 7,829,611 | — | 单页工具用 composable 足够 |
| `vue-sonner` | 3,401,390 | ~25 KB min | 原生 `aria-live` 提示足够 |
| `natural-orderby` | 9,787,675 | — | `Intl.Collator` 原生支持 numeric |
| `reka-ui` | 3,243,977 | — | 原生表单控件足够 |

> 数据来源：npm downloads API，统计区间 2026-11-12 ~ 2026-11-18；体积来自 Bundlephobia 完整入口。

## 10. 测试计划

| 文件 | 覆盖点 |
| --- | --- |
| `xml.test.ts` | 五个 XML 字符、`&` 优先转义、无双重转义 |
| `chapter.test.ts` | 合法/非法/空正则、前言、连续标题、空白行、零匹配单章、标题 trim、捕获组 |
| `encoding.test.ts` | 全部别名、大小写/空格、未知编码、`TextDecoder` 可用性 |
| `comic.test.ts` | 扩展名过滤、目录过滤、`1/2/10` 自然序、同名不同目录、大小写 |
| `documents.test.ts` | nav/ncx/xhtml 结构、href 对应、元数据转义 |
| `package.test.ts` | opf manifest 数量/spine 顺序、漫画 `rendition`、language |
| `build-text.test.ts` | mimetype 第一且 STORE、必需路径、章节数量、单章回退、确定性 |
| `build-comic.test.ts` | 图片/页面/清单一致、MIME 类型、空图片输入报错 |
| `line-reader.test.ts` | 跨 64KB 多字节字符、CRLF/CR/LF、BOM、空文件、非法编码、取消 |
| `encoding-detect.test.ts` | GBK/UTF-8 字节检测、失败回退标记 |
| `text-source.test.ts` | 全文索引与预览一致、扫描可取消 |
| `epub-pack.test.ts` | fflate 解包校验内容、mimetype 顺序与压缩方式、进度回调、固定 mtime |

要求：

- `pnpm test` 恢复为 `vitest run`。
- 新增 `test:coverage`。
- `src/domain/**` 覆盖率 ≥ 90%（行/分支）；`src/services/**` 重点路径全部覆盖。
- 不做组件测试；交互用 Playwright MCP 验证，截图与日志保存到 `.playwright-mcp/<时间>/`，验证后关闭浏览器。

## 11. 实施阶段

- [x] **阶段 0：计划定稿**
  - 完成架构、依赖、测试策略确认。
  - 本文档建立。

- [ ] **阶段 1：领域层 + 测试**
  - 实现 `domain/` 全部纯函数与单元测试。
  - 不接 UI，不修改现有页面。
  - 退出标准：domain 测试全绿，覆盖率 ≥ 90%。

- [ ] **阶段 2：服务层 + 测试**
  - 实现行读取、编码检测、全文扫描、ZIP 读取、fflate 打包、下载。
  - 退出标准：服务层测试全绿，可取消、可报告进度。

- [ ] **阶段 3：composables + 组件**
  - 接入 VueUse，拆分组件，删除旧 `src/utils/*`。
  - 退出标准：页面功能等价，`pnpm check` 通过。

- [ ] **阶段 4：体验补齐**
  - 拖拽上传、全文目录、错误提示、原生进度条、文件名修复。
  - 退出标准：验收场景全部通过。

- [ ] **阶段 5：文档与收尾**
  - 更新 `README.md`、`AGENTS.md`，补充 `docs/ARCHITECTURE.md`。
  - 退出标准：`pnpm check && pnpm build` 通过，浏览器验证完成。

## 12. 验收标准

- [ ] `pnpm check` 全绿，`pnpm build` 成功。
- [ ] UTF-8 TXT、GBK TXT、无章节短篇、多图片 ZIP 均能生成可打开且目录正确的 EPUB。
- [ ] `mimetype` 是 ZIP 第一个文件，未压缩，无 extra field。
- [ ] 文本 EPUB 的目录数量、章节正文与预览一致。
- [ ] 漫画 EPUB 图片顺序与预览一致，MIME 类型正确。
- [ ] 非法正则、超限文件、空 ZIP、非图片 ZIP、未知编码均有明确提示。
- [ ] 快速切换文件或修改正则不会出现旧结果回写。
- [ ] 生成过程有可见进度，完成后有状态播报。

## 13. 非目标

- 封面图。
- 多级目录、卷/分册。
- Markdown 语法渲染。
- Web Worker 打包（保留后续优化空间）。
- 出版社、出版日期等额外元数据。
- 后端服务、账号、云存储、遥测。

## 14. 进度记录

| 日期 | 阶段 | 内容 | 验证 |
| --- | --- | --- | --- |
| 2026-11-20 | 阶段 0 | 架构、依赖、测试策略定稿；计划文档建立 | — |

## 15. 维护约定

- 每完成一个阶段，更新第 11 节复选框和第 14 节进度记录。
- 记录实际执行的验证命令与结果，例如 `pnpm check`、`pnpm build`、浏览器验证场景。
- 若实施中推翻已确认决策，先在本文档记录原因和新结论，再改代码。
- 新增/删除依赖必须回到第 9 节更新决策记录，并遵守 `AGENTS.md` 的依赖审批规则。
- 未获用户明确许可，不执行 commit 或 push。
