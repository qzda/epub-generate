# Epub Generate

把 TXT/MD 文本或 ZIP 图片包，在浏览器本地生成 EPUB 3 电子书。

- 在线地址：<https://epub-generate.netlify.app/>
- 纯静态站点，无后端、无账号、无上传
- 文本模式按正则分章，漫画模式按图片自然序排页

## 功能

### 文本模式

- 支持 `.txt`、`.md`，以及浏览器识别为 `text/*` 的文件
- 自动检测文本编码，检测不可靠时回退 UTF-8 并提示
- 支持 UTF-8、UTF-16、GBK/GB18030、Big5、Shift_JIS、EUC-JP、EUC-KR、ISO-8859、Windows-125x、KOI8-R 等
- 按用户提供的正则逐行匹配章节标题
- 全文扫描生成完整目录，不受“预览 200 行”限制
- 首个章节标题前的内容记为「前言」
- 没有匹配到章节时，全文作为单章「正文」输出
- 预览、目录与最终 EPUB 共用同一套分章逻辑

默认章节正则：

```text
^\s*第[0-9一二三四五六七八九十百千万]+章(?:\s|$)
```

可以在界面中改成自己的规则，例如：

```text
^Chapter\s+\d+
^\s*第.+[章节回卷部篇]
```

### 漫画模式

- 上传 `.zip` 图片包
- 支持 `.jpg`、`.jpeg`、`.png`、`.gif`、`.webp`、`.bmp`
- 按文件名自然序排序（`1.png`、`2.png`、`10.png`）
- 一张图片一页，生成固定版式 EPUB（`rendition:layout = pre-paginated`）
- 忽略目录项和非图片文件
- 预览前 20 张图片，实际导出包含全部图片

### 通用

- 支持拖拽上传、文件选择与键盘操作
- 单文件上限 50 MB
- 生成过程显示读取、构建、压缩进度
- 错误用页面提示展示，不使用 `alert`
- 自动跟随系统浅色/暗色模式
- 所有文件只在浏览器内存中处理，不上传、不记录正文

## EPUB 输出

- EPUB 3 结构，同时保留 `toc.ncx` 以兼容旧阅读器
- 始终生成 `OEBPS/nav.xhtml`
- `mimetype` 是 ZIP 第一个文件且不压缩，无 extra field
- 固定 ZIP 内文件时间戳，便于测试与复现；书籍 identifier 和修改时间在导出时注入
- 漫画 EPUB 包含固定版式元数据

```text
mimetype
META-INF/container.xml
OEBPS/content.opf
OEBPS/nav.xhtml
OEBPS/toc.ncx
OEBPS/style.css
OEBPS/chapter0.xhtml ...   # 文本模式
OEBPS/page0.xhtml ...      # 漫画模式
OEBPS/images/image0.png ...# 漫画模式
```

## 本地开发

要求 Node.js 20+，使用 pnpm。

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm dev            # 开发服务器
pnpm build          # 先跑完整检查，再构建 dist
pnpm preview        # 预览生产构建
pnpm check          # lint + typecheck + test
pnpm lint           # ESLint 自动修复
pnpm lint:check     # ESLint 只检查
pnpm typecheck      # vue-tsc
pnpm test           # Vitest 单次运行
pnpm test:watch     # Vitest 监听
pnpm test:coverage  # 覆盖率报告
```

## 项目结构

```text
src/
├─ domain/       # 纯函数：分章、编码、漫画排序、EPUB 构建
├─ services/     # 浏览器 IO：文件读取、编码检测、ZIP、fflate、下载
├─ composables/  # Vue 状态编排、扫描取消、导出进度、消息
├─ components/   # 展示组件
├─ config/       # 文件大小、分块、预览数量
└─ App.vue       # 页面组合与导出入口
```

更详细的层次边界与数据流见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)；重构进度与依赖决策见 [docs/REWRITE-PLAN.md](docs/REWRITE-PLAN.md)。

## 测试与校验

- Vitest（Node 环境）覆盖 `src/domain/**` 和 `src/services/**`
- domain 按文件要求行/分支/函数/语句覆盖率 ≥ 90%
- 当前 19 个测试文件、150 个用例
- 不做组件单测；交互通过 Playwright 浏览器验证

提交前运行：

```bash
pnpm check
```

## 部署

构建产物是纯静态文件：

```bash
pnpm build
```

将 `dist/` 部署到 Netlify 或任意静态托管即可。项目不需要环境变量、服务端函数或数据库。

## 非目标

- 封面图
- 多级目录、卷/分册
- Markdown 语法渲染（按纯文本处理）
- 出版社、出版日期等额外出版元数据
- 后端服务、账号、云存储、遥测或分析 SDK

## License

MIT
