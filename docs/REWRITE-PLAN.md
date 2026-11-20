# Epub Generate 重写计划

> 状态：阶段 1–5 全部完成
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
│     ├─ scaffold.ts           # 共用固定文件序列与 OPF/nav/ncx 装配
│     ├─ build-text.ts         # buildTextEpub(meta, chapters, id, modifiedAt)
│     └─ build-comic.ts        # buildComicEpub(meta, pages, id, modifiedAt)
├─ services/                   # 浏览器 IO，薄适配层
│  ├─ abort.ts                 # AbortSignal 检查与 AbortError
│  ├─ binary.ts                # Uint8Array → BlobPart，兼容 SharedArrayBuffer
│  ├─ line-reader.ts           # File + 编码 → 异步行流
│  ├─ encoding-detect.ts       # chardet 适配，返回检测结果与回退标记
│  ├─ text-source.ts           # 全文扫描：预览行、章节索引、总行数；导出用章节读取
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
│  ├─ TextSettings.vue         # 编码、章节正则与扫描状态
│  ├─ TextWorkspace.vue        # 预览 + 完整目录
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
  | "NO_CHAPTERS"
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
- `buildEpubScaffold`（`epub/scaffold.ts`）
  - 文本与漫画共用，集中生成固定文件序列，避免两套 builder 各写一遍。
  - 顺序：`mimetype`（STORE）→ `META-INF/container.xml` → `OEBPS/content.opf` → `nav.xhtml` → `toc.ncx` → `style.css`。
- `buildTextEpub` / `buildComicEpub`
  - 接收注入的 `id` 和 `modifiedAt`，输出确定性的 `EpubEntry[]`。
  - 先调用 `buildEpubScaffold`，再追加章节 XHTML 或页面 XHTML + 图片。
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
- `readTextChapters(file, encoding, regex, { signal })`
  - 为导出保留章节正文，与预览共用同一个分章器和行读取器。
- `packEpub(entries, { onProgress, signal })`
  - 唯一接触 `fflate` 的地方。
  - 使用非流式 `zip`，保证 `mimetype` 的本地文件头包含真实大小、无 data descriptor。
  - 固定 `mtime`，保证相同输入产物稳定；进度按准备阶段（0 → 0.2）与完成（1）上报。
  - 压缩中取消会通过 `AbortSignal` 立即拒绝。
- `downloadBlob(blob, fileName)`
  - `<a download>` + `URL.revokeObjectURL`，放在 `try/finally`。

错误统一使用 `AppError`（带 `cause`）；用户输入校验在领域层用 `Result` 返回，UI 不再出现 `alert`。

## 8. UI 规划

采用方案 B「卡片工作台」：

```text
App.vue
├─ 顶栏：品牌 + 本地处理状态
├─ Hero：标题说明 + 上传文件 / 生成 EPUB
├─ 消息：顶部居中 AppNotice（保留原样式）
└─ 工作区
   ├─ 左卡：文件信息 + 书籍信息 + 文本设置 / 漫画说明
   └─ 右卡：正文预览（预览 / 目录切换 + 章节 chips）或漫画预览网格
```

视觉规则：

- 浅蓝灰背景 `#f2f6fc`，白色圆角卡片，蓝色主色 `#2f63e9`。
- 卡片圆角 20px，输入框 11px，按钮 12px；主按钮使用蓝色渐变。
- 顶部 Hero 使用浅色渐变与柔和光斑，保持单页工作台结构。
- 消息组件保持顶部居中原样式。
- 跟随系统 `prefers-color-scheme` 自动切换浅色/暗色，颜色统一走 CSS 变量。
- Hero 与拖拽区之间保留 20px 间距，避免卡片粘连。

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

- 新增运行时：`fflate`（阶段 2 已安装）、`@vueuse/core`（阶段 3 已安装）
- 移除运行时：`jszip`（阶段 3 删除旧 `utils/epub.ts` 时已移除）
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
| `line-reader.test.ts` | 跨分块多字节字符、CRLF/CR/LF、BOM、空文件、非法编码、取消 |
| `encoding-detect.test.ts` | GBK/UTF-8/ASCII 检测、失败回退标记、sniffSize |
| `text-source.test.ts` | 全文索引与预览一致、章节正文、扫描可取消 |
| `comic-source.test.ts` | ZIP 校验、自然序、预览数量、URL 清理、空包与无图片 |
| `epub-pack.test.ts` | 解包校验内容、mimetype 顺序与压缩方式、进度、确定性、取消 |
| `epub-pack.errors.test.ts` | 压缩中取消、fflate 回调/同步异常 |
| `download.test.ts` | 链接创建、点击、异常时 URL 释放、默认全局依赖 |
| `binary.test.ts` | ArrayBuffer 视图零拷贝、SharedArrayBuffer 视图复制 |
| `abort.test.ts` | AbortError 创建、取消检查、错误识别 |

要求：

- `pnpm test` 恢复为 `vitest run`。
- 新增 `test:coverage`。
- `src/domain/**` 按文件行/分支/函数/语句 ≥ 90%；`src/services/**` 重点路径全部覆盖并纳入全局阈值。
- 不做组件测试；交互用 Playwright MCP 验证，截图与日志保存到 `.playwright-mcp/<时间>/`，验证后关闭浏览器。

## 11. 实施阶段

- [x] **阶段 0：计划定稿**
  - 完成架构、依赖、测试策略确认。
  - 本文档建立。

- [x] **阶段 1：领域层 + 测试**
  - 实现 `domain/` 全部纯函数与单元测试。
  - 不接 UI，不修改现有页面。
  - 退出标准：domain 测试全绿，覆盖率 ≥ 90%。
  - 完成情况：10 个测试文件、86 个用例全绿；domain 覆盖率行 99.2%、分支 98.63%，按文件阈值 90% 校验通过。

- [x] **阶段 2：服务层 + 测试**
  - 实现行读取、编码检测、全文扫描、ZIP 读取、fflate 打包、下载。
  - 退出标准：服务层测试全绿，可取消、可报告进度。
  - 完成情况：18 个测试文件、146 个用例全绿；services 行覆盖 99.37%、分支 98.83%，全局行覆盖 99.42%。

- [x] **阶段 3：composables + 组件**
  - 接入 VueUse，拆分组件，删除旧 `src/utils/*`。
  - 退出标准：页面功能等价，`pnpm check` 通过。
  - 完成情况：接入 `useDropZone`、`useFileDialog`、`watchDebounced`；拆出 7 个组件与 4 个 composable；删除旧 `utils/*`、`types.ts` 与 `jszip`；19 个测试文件、149 个用例全绿，构建成功。

- [x] **阶段 4：体验补齐**
  - 拖拽上传、全文目录、错误提示、原生进度条、文件名修复。
  - 退出标准：验收场景全部通过。
  - 完成情况：新增拖拽覆盖提示、读取行数进度、文件大小格式化；Playwright 验证超限/PDF/空 ZIP/无图片提示、快速切换、读取进度 5%→33%、短篇单章与导出结构；19 个测试文件、150 个用例全绿。

- [x] **阶段 5：文档与收尾**
  - 更新 `README.md`、`AGENTS.md`，补充 `docs/ARCHITECTURE.md`。
  - 退出标准：`pnpm check && pnpm build` 通过，浏览器验证完成。
  - 完成情况：README 补充功能、支持范围、命令与 EPUB 结构；新增架构文档；AGENTS 补充文档维护要求；最终检查与构建通过，Playwright 原生 WebM 录屏验证已完成。

## 12. 验收标准

- [x] `pnpm check` 全绿，`pnpm build` 成功。
- [x] UTF-8 TXT、GBK TXT、无章节短篇、多图片 ZIP 均能生成可打开且目录正确的 EPUB。
- [x] `mimetype` 是 ZIP 第一个文件，未压缩，无 extra field。
- [x] 文本 EPUB 的目录数量、章节正文与预览一致。
- [x] 漫画 EPUB 图片顺序与预览一致，MIME 类型正确。
- [x] 非法正则、超限文件、空 ZIP、非图片 ZIP、未知编码均有明确提示。
- [x] 快速切换文件或修改正则不会出现旧结果回写。
- [x] 生成过程有可见进度，完成后有状态播报。

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
| 2026-11-20 | 阶段 1 | 完成 `src/domain/`：Result/错误码、书籍元数据、编码别名、流式分章器、漫画排序、EPUB 文档与纯函数 builder；抽取 `epub/scaffold.ts` 统一文本/漫画固定文件序列；新增 `result.test.ts` 与捕获组分章用例；安装 `@vitest/coverage-v8`，`test` 改为 `vitest run`，新增 `test:coverage` 并按文件校验 90% 阈值；ESLint 忽略 `coverage/` | `pnpm check` 通过；`pnpm test:coverage` 10 文件 86 用例全绿，domain 行覆盖 99.2%、分支 98.63% |
| 2026-11-20 | 阶段 2 | 完成 `src/services/`：`readFileLines`（CRLF/CR/LF、跨块多字节、BOM、取消）、`detectTextEncoding`（chardet + 回退标记）、`scanTextSource`/`readTextChapters`、`readComicSource`（ZIP 签名、自然序、预览 URL、dispose）、`packEpub`（fflate、mimetype STORE、固定 mtime、进度、取消）、`downloadBlob`；新增 `config/limits.ts` 与 `services/abort.ts`；安装 `fflate`，覆盖率纳入 services 并保留 domain 按文件 90% 阈值 | `pnpm check` 通过；`pnpm test:coverage` 18 文件 146 用例全绿，services 行覆盖 99.37%、分支 98.83%，全局行覆盖 99.42% |
| 2026-11-20 | 阶段 3 | 重写 `App.vue` 为组合入口；新增 `useTextSource`（防抖/取消/全文目录）、`useComicSource`（ZIP 预览与 URL 清理）、`useExport`（阶段进度/错误）、`useMessages`；拆出 SourceDropzone、BookMetaForm、TextSettings、TextWorkspace、ComicWorkspace、ExportBar、AppNotice；接入 VueUse 拖拽与文件选择；删除旧 `utils/*`、`types.ts` 与 `jszip`；默认正则改为锚定章节标题；新增 `abort.test.ts` | `pnpm check` 通过；`pnpm test:coverage` 19 文件 149 用例全绿；Playwright 验证 UTF-8/GBK 文本与漫画 ZIP 预览、导出结构、非法正则与无图片错误；截图与 EPUB 保存在 `.playwright-mcp/2026-11-20T13-03/` |
| 2026-11-20 | UI 重构 | 选定方案 B「卡片工作台」；重做顶栏、Hero、左设置卡与右预览卡；文本预览增加「预览 / 目录」切换和章节 chips；漫画预览改为卡片网格；更新主题色与 UnoCSS 快捷类；保留顶部居中消息组件；补齐 Hero 与拖拽区间距，支持系统暗色模式 | `pnpm check`、`pnpm build` 通过；Playwright 验证桌面/移动空状态、文本预览、目录切换、漫画预览与导出；浅色/暗色截图保存在 `.playwright-mcp/2026-11-20T13-20/` 与 `.playwright-mcp/2026-11-20T13-44/` |
| 2026-11-20 | 阶段 4 | 新增拖拽覆盖提示、`readTextChapters` 读取行数进度、文件大小 B/KB/MB 格式化；补充进度单元测试；完成验收场景：超限、PDF、空 ZIP、无图片 ZIP、快速切换、进度、短篇单章、导出结构 | `pnpm check`、`pnpm build` 通过；19 文件 150 用例全绿；Playwright 截图/EPUB/快照/日志保存在 `.playwright-mcp/2026-11-20T14-13/` |
| 2026-11-20 | 阶段 5 | 重写 README（功能、支持范围、命令、EPUB 结构、部署）；新增 `docs/ARCHITECTURE.md`（分层、数据流、错误模型、取消、确定性、测试）；AGENTS 补充文档维护要求；最终检查与构建 | `pnpm check`、`pnpm build` 通过；Playwright 原生 WebM 录屏与文本/漫画导出验证保存在 `.playwright-mcp/2026-11-20T14-58/` |

## 15. 维护约定

- 每完成一个阶段，更新第 11 节复选框和第 14 节进度记录。
- 记录实际执行的验证命令与结果，例如 `pnpm check`、`pnpm build`、浏览器验证场景。
- 若实施中推翻已确认决策，先在本文档记录原因和新结论，再改代码。
- 新增/删除依赖必须回到第 9 节更新决策记录，并遵守 `AGENTS.md` 的依赖审批规则。
- 未获用户明确许可，不执行 commit 或 push。
