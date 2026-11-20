# 开发与 Agent 约束

本文档约束所有后续参与 Epub Generate 项目的自动化 agent、AI 编码助手和人工协作者。

## 最高优先级规则

未经用户明确允许，任何 agent 不准执行：

- `git commit`
- `git push`
- 创建 tag
- 发布 release
- 修改远程仓库配置
- 强制回滚或重置用户改动

即使代码已经通过构建或测试，也必须等待用户明确授权后才能 commit 或 push。

## 提交规则

只有用户明确要求提交代码时，agent 才能执行 `git commit`。

提交信息必须符合 [Angular Team Commit Specification](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#-git-commit-guidelines)。

提交信息格式：

```text
<type>(<scope>): <subject>
```

要求：

- `scope` 可选。
- `type` 使用 Angular 规范中的类型，例如 `feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`chore`。
- `subject` 使用简短祈使句，不以大写开头，不以句号结尾，但不能遗漏本次提交的主要用户可见改动。
- `subject` 与 `body` 尽量使用中文描述；技术名词、变量名、函数名、类型名、API 名等固定标识不用强制翻译。
- 任意一行不超过 100 个字符。
- 需要正文或 footer 时，header、body、footer 之间用空行分隔。
- 当改动涉及多个功能点、多个架构边界或大量文件时，必须写 body。
- body 应覆盖主要行为变化、依赖变化、文档同步和重要验证结果，不要只重复 header。
- Breaking Change 必须在 footer 中用 `BREAKING CHANGE:` 标记。
- 提交信息不要添加 `Co-Authored-By` 署名，也不要署名任何 AI 或自动化工具。

示例：

```text
feat(comic): 支持按自然序排列漫画 ZIP 图片

- 先按文件名自然序比较，再回退到完整路径比较，避免 2.jpg 排在 10.jpg 之后。
- 预览与最终 EPUB 共用同一套排序逻辑。
- 补充 readFileLinesWithEncoding 的分块读取测试。
```

无论用户是否要求 commit，agent 永远不准执行 `git push`。push 必须由用户自己完成。

## 项目概览

Epub Generate 是纯前端的本地工具：用户在浏览器里选择文本文件或图片压缩包，前端直接生成并下载 `.epub`，没有后端服务。

支持两种模式：

- 文本模式：读取 TXT/MD，按用户提供的章节正则分章，生成带目录的 EPUB。
- 漫画模式：读取 ZIP 图片包，按自然序排序图片，每张图一页生成固定版式 EPUB。

部署目标是静态站点（Netlify），所有处理都在浏览器本地完成。

## 技术栈与关键文件

- 构建与开发：Vite + TypeScript + `vue-tsc`。
- 框架：Vue 3 `<script setup>` 单文件组件。
- 样式：UnoCSS（`presetWind4`、`presetMini`、`presetAttributify`、`presetIcons`），主题与快捷类集中在 `unocss.config.ts`。
- EPUB 打包：`jszip`。
- 编码检测：`chardet` + 浏览器 `TextDecoder`。
- 测试：Vitest（Node 环境，纯函数优先）。

关键文件：

- `src/App.vue`：页面结构、状态、文件选择、预览、交互入口。
- `src/utils/epub.ts`：EPUB 目录结构与文件生成（文本 / 漫画两种模式）。
- `src/utils/file.ts`：按指定编码分块流式读取文本行。
- `src/utils/text.ts`：支持编码列表、编码别名归一化与自动检测。
- `src/types.ts`：`Chapter` 等共享类型。
- `vite.config.ts`：Vue、UnoCSS 插件与生产分包配置。
- `vitest.config.ts`：测试环境配置。

## 文件与职责边界

实现阶段必须遵守：

- 页面与交互逻辑集中在 `src/App.vue`；可复用的纯逻辑放到 `src/utils/`。
- Epub Generate 只做客户端逻辑，不要引入 Node 专用 API（如 `fs`、`path`、`Buffer`）。
- 文件读取必须走 `readFileLinesWithEncoding` 之类的流式入口，不要一次性把大文件完整读进内存再按行切分。
- 编码支持范围以 `EncodingList` 为准；新增编码必须同时补充别名映射，并确认浏览器 `TextDecoder` 可用。
- EPUB 结构约定必须保持：
  - `mimetype` 必须是第一个文件且不压缩（`compression: "STORE"`）。
  - 必须包含 `META-INF/container.xml`，并指向 `OEBPS/content.opf`。
  - 有目录时生成 `OEBPS/toc.ncx` 与 `OEBPS/nav.xhtml`，并在 `content.opf` 中声明。
  - 无章节匹配的短篇文本按单章「正文」输出，不强行生成空目录。
- 所有写入 EPUB 的用户内容必须经过 `escapeXml`，禁止把原始输入直接拼进 XHTML/OPF。
- 漫画图片排序必须保持「先按文件名自然序、再按完整路径」的稳定规则，预览和最终生成不能各写一套。
- 对象 URL 的生命周期必须显式管理：预览图片使用后要 `URL.revokeObjectURL`，组件卸载时清理。
- 不要随意改动 `manualChunks` 分包策略；确有需要时说明对首屏体积的影响。

## 当前阶段限制

除非用户明确要求，否则不要：

- 添加后端服务、账号系统、云存储、遥测或分析 SDK。
- 把用户选择的文件、文本内容或图片上传到任何外部服务。
- 引入大体积依赖只为解决少量格式转换问题。
- 大规模重构无关模块或重写 UI 结构。
- 切换包管理器、删除 lockfile 或重写构建配置。

## 隐私与本地优先

文本文件和漫画图片可能包含用户隐私内容。

任何 agent 编写或修改代码时，都必须保持：

- 文件内容只在浏览器内存与本地存储中处理，不上传、不同步到远程服务。
- 不引入默认联网、遥测、崩溃上传或分析 SDK。
- 不把书籍内容、图片数据或文件内容写入外部日志或第三方存储。
- 调试输出只允许出现在 `console` 中，且不得包含完整的书籍正文。

## 质量校验

提交前默认运行：

```bash
pnpm check
```

`pnpm check` 依次执行：

```bash
pnpm run lint:check   # eslint .
pnpm run typecheck    # vue-tsc -b
pnpm run test         # vitest run
```

其他常用命令：

- `pnpm lint`：自动修复 lint 问题。
- `pnpm test:watch`：监听模式运行测试。
- `pnpm build`：先跑 `pnpm check`，再执行 `vite build`。

仓库已配置 Husky + lint-staged：

- `.husky/pre-commit` 会执行 `pnpm run check` 和 `pnpm exec lint-staged`。
- 不要使用 `--no-verify` 跳过检查，除非用户明确要求。

## 测试与验证

- 当前项目暂未编写测试文件，`vitest` 基建已就绪；等实现结构整理稳定后再逐步补充 `*.test.ts`。
- 补充测试时优先覆盖：编码检测与别名归一化、分块读取行、章节切分、漫画图片排序、EPUB 结构生成。
- 涉及交互或浏览器行为时，应验证：
  - 上传 TXT/MD 后能自动检测编码并预览前 200 行。
  - 修改章节正则后目录识别数量实时更新。
  - 上传 ZIP 后能看到前 20 张图片预览，图片顺序正确。
  - 生成 EPUB 后文件能正常打开，目录与章节/页面数量正确。
  - 切换到无效正则或空文件时有明确提示，不出现未捕获异常。
- 使用 Playwright MCP 做浏览器验证时，截图与日志统一保存到项目根目录 `.playwright-mcp/<时间>/`；验证完成后关闭浏览器。

## 文档优先

当新增或修改以下能力时，应同步更新 `README.md`：

- 支持的输入格式、编码、章节正则规则。
- 文本模式与漫画模式的行为差异。
- EPUB 输出结构或兼容性说明。
- 构建、测试、校验命令的变化。

文档和实现发生冲突时，必须在提交前统一；不能让文档长期描述不存在或相反的行为。

## 依赖约束

新增第三方依赖前必须说明：

- 解决什么问题。
- 为什么现有浏览器 API 或已安装依赖不足。
- 对包体积、启动性能、构建速度和维护成本的影响。
- 是否会读取、上传或处理用户的书籍文件与图片。

未经用户允许，不得添加会上传本地数据、采集用户行为、接入远程服务或改变隐私边界的依赖。

## 协作礼仪

- 不擅自重构无关文件。
- 不覆盖用户未提交改动。
- 不因为构建失败就回滚用户改动。
- 遇到需求不明确时，优先做小范围、可解释、可回退的改动。
- 输出结论时说明改了哪些文件、没有改哪些文件、是否运行了验证。
