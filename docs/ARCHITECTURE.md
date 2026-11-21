# 架构说明

本文档描述 Epub Generate 的层次边界、主要数据流和约束。实现进度与依赖决策见 [REWRITE-PLAN.md](REWRITE-PLAN.md)。

## 1. 分层

```text
App.vue / components
        ↓ props / events
composables
        ↓
services
        ↓
domain
```

依赖只能向下：

- `domain/`：纯函数与领域模型。不 import Vue、组件、fflate、JSZip、chardet 或 DOM。编码可用性检查使用浏览器/Node 都提供的 `TextDecoder`。
- `services/`：浏览器 IO 适配层。负责 `File`/`Blob`、`TextDecoder`、`chardet`、`fflate`、ZIP、对象 URL、下载。唯一接触 `fflate` 的地方是 `epub-pack.ts`。
- `composables/`：Vue 状态编排。组合 services，处理防抖、取消、竞态、通知和导出阶段。
- `components/`：展示与用户交互，不直接读文件、不直接打包。
- `App.vue`：布局与组合，不实现分章、排序或 EPUB 结构。

## 2. 目录

```text
src/
├─ domain/
│  ├─ result.ts          # Result、AppError、DomainError
│  ├─ book.ts            # 书籍元数据、文件名清洗
│  ├─ chapter.ts         # 多级正则编译、层级归一化、流式分章器
│  ├─ encoding.ts        # 编码列表、别名、可用性
│  ├─ comic.ts           # 图片识别、自然序、MIME
│  └─ epub/
│     ├─ types.ts        # EpubEntry / 输入类型
│     ├─ xml.ts          # escapeXml
│     ├─ documents.ts    # 章节页、漫画页、nav、ncx
│     ├─ package.ts      # OPF、container、CSS、基础 manifest
│     ├─ scaffold.ts     # 共用固定文件序列
│     ├─ build-text.ts   # 文本 EPUB 条目
│     └─ build-comic.ts  # 漫画 EPUB 条目
├─ services/
│  ├─ abort.ts           # AbortError / 取消检查
│  ├─ binary.ts          # Uint8Array -> BlobPart
│  ├─ line-reader.ts     # 分块读取、换行处理
│  ├─ encoding-detect.ts # chardet 适配
│  ├─ text-source.ts     # 全文扫描、章节读取与进度
│  ├─ comic-source.ts    # ZIP 读取、预览 URL、dispose
│  ├─ epub-pack.ts       # fflate 打包
│  └─ download.ts        # Blob 下载与 URL 释放
├─ composables/
│  ├─ useTextSource.ts
│  ├─ useComicSource.ts
│  ├─ useExport.ts
│  └─ useMessages.ts
├─ components/
│  ├─ SourceDropzone.vue
│  ├─ BookMetaForm.vue
│  ├─ TextSettings.vue
│  ├─ TextWorkspace.vue
│  ├─ ComicWorkspace.vue
│  ├─ ExportBar.vue
│  └─ AppNotice.vue
├─ config/limits.ts
└─ App.vue
```

## 3. 文本模式数据流

### 导入与预览

1. `App.vue` 校验扩展名/类型和 50 MB 上限。
2. `detectTextEncoding` 读取前 64 KB，用 chardet 检测并归一化；失败回退 UTF-8 并返回 `fallback`。
3. `useTextSource` 监听文件、编码、正则变化，250ms 防抖后取消旧扫描。
4. `compileChapterPatterns` 把多行正则编译为 1–3 级匹配器；空行忽略，超过 3 行报错。
5. `scanTextSource` 流式读取全文，一次返回：
   - 前 200 行预览
   - 完整 `ChapterRef[]`（含 `level`）
   - 总行数
   - 标题匹配数
6. 分章结束时归一化层级：去掉缺失的中间层、把同层标题保持为兄弟节点；如果全书只有二级标题，会整体提升为一级。
7. `TextWorkspace` 只负责展示；目录与预览来自同一次扫描，目录按 `level` 缩进。

### 导出

1. `compileChapterPatterns` 编译多级正则。
2. `readTextChapters` 再流式读取全文，保留章节正文和层级，并按已处理行数回调进度。
3. `buildTextEpub` 用 `buildTocItems` 把扁平章节转成嵌套目录，再生成确定性 `EpubEntry[]`。
4. `packEpub` 用 fflate 打包为 Blob。
5. `downloadBlob` 触发下载并释放对象 URL。

## 4. 漫画模式数据流

1. `readComicSource` 校验 ZIP 签名、解包、过滤目录和非图片。
2. `collectComicImages` 按 basename 自然序排序，再按完整路径稳定比较。
3. 为前 20 张图片创建对象 URL；`dispose()` 负责释放。
4. 导出时 `buildComicEpub` 生成页面 XHTML、图片条目和固定版式 OPF。
5. 继续走统一的 `packEpub` / `downloadBlob`。

预览与导出共用同一份排序后的图片清单，避免顺序不一致。

## 5. 错误模型

- 用户输入校验使用 `Result<T, AppError>`，例如章节正则。
- 服务层和构建阶段使用 `DomainError`（带 `code`、`message`、`cause`）。
- UI 不显示原始异常堆栈，只显示可读消息；错误通过 `AppNotice` 或表单附近提示。
- 常见错误码：`FILE_TOO_LARGE`、`UNSUPPORTED_FILE`、`INVALID_ENCODING`、`INVALID_PATTERN`、`EMPTY_ARCHIVE`、`NO_IMAGES`、`NO_CHAPTERS`、`PACK_FAILED`。

## 6. 取消与竞态

- 扫描、漫画读取、导出都使用 `AbortController`。
- 新文件/新正则会取消旧扫描，并用递增请求 ID 丢弃过期结果。
- `useComicSource` 在文件切换和组件卸载时释放旧预览 URL。
- `useExport` 在组件卸载时取消正在进行的打包。

## 7. EPUB 确定性

- `buildTextEpub` / `buildComicEpub` 接收注入的 `identifier` 和 `modifiedAt`，不在领域层生成随机值或时间。
- 所有用户文本都经过 `escapeXml`。
- 固定文件顺序：`mimetype` → `container.xml` → `content.opf` → `nav.xhtml` → `toc.ncx` → `style.css` → 章节/页面。
- `nav.xhtml` 按标题层级输出嵌套 `<ol>`；`toc.ncx` 输出嵌套 `<navPoint>`，`playOrder` 按文档顺序连续递增，`dtb:depth` 取实际最大层级。
- spine 与 manifest 仍按扁平章节顺序排列，卷/部也会生成独立页面。
- `mimetype` 使用 `STORE`；ZIP 内 mtime 固定为本地时间 1980-01-01。
- `packEpub` 使用非流式 fflate API，确保 mimetype 本地文件头包含真实大小且无 data descriptor。

## 8. UI 组合

- 单页工作台：顶栏 + Hero + 左设置卡 + 右预览卡。
- 文本主卡支持“预览 / 目录”切换；目录按层级缩进，chips 只展示一级标题。
- 主卡高度受视口约束，预览与目录在卡片内部滚动，页面不随正文长度增长。
- 漫画主卡为响应式卡片网格。
- 消息组件固定在顶部居中，使用 `aria-live`。
- 颜色通过 CSS 变量控制，跟随系统 `prefers-color-scheme`。

## 9. 测试

- Vitest（Node 环境），覆盖 `src/domain/**` 与 `src/services/**`。
- domain 按文件要求覆盖率 ≥ 90%；services 保持重点路径覆盖并纳入全局阈值。
- 测试重点：
  - 多级分章、层级归一化、嵌套 nav/ncx、编码别名、漫画排序、EPUB 文档与 OPF
  - 分块行读取、BOM、CRLF/CR、取消
  - ZIP 签名、预览清理、mimetype 头、固定 mtime
  - 导出读取进度
- 组件不做单测，交互使用 Playwright 验证。

## 10. 隐私与边界

- 只在浏览器本地处理文件，不上传、不记录正文。
- 不引入遥测、分析或远程服务。
- 不引入 Node 专用 API。
- 新增运行时依赖必须先按 `AGENTS.md` 的依赖审批流程确认。
