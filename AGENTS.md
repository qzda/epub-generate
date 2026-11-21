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
- 补充 readFileLines 的分块读取测试。
```

无论用户是否要求 commit，agent 永远不准执行 `git push`。push 必须由用户自己完成。

## 项目概览

Epub Generate 是纯前端的本地工具：用户在浏览器里选择文本文件或图片压缩包，前端直接生成并下载 `.epub`，没有后端服务。

支持两种模式：

- 文本模式：读取 TXT/MD，按用户提供的 1–3 级标题正则分章，生成带嵌套目录的 EPUB。
- 漫画模式：读取 ZIP 图片包，按自然序排序图片，每张图一页生成固定版式 EPUB。

部署目标是静态站点（Netlify），所有处理都在浏览器本地完成。

## 技术栈与关键文件

- 构建与开发：Vite + TypeScript + `vue-tsc`。
- 框架：Vue 3 `<script setup>` 单文件组件。
- 样式：UnoCSS（`presetWind4`、`presetMini`、`presetAttributify`、`presetIcons`），主题与快捷类集中在 `unocss.config.ts`。
- EPUB 打包：`fflate`。
- 交互工具：`@vueuse/core`（拖拽、文件选择、防抖）。
- 编码检测：`chardet` + 浏览器 `TextDecoder`。
- 测试：Vitest（Node 环境，纯函数优先）。

关键文件：

- `src/App.vue`：页面布局、状态编排、文件选择与导出入口。
- `src/domain/`：纯函数领域层（分章、编码、漫画排序、EPUB 构建）。
- `src/services/`：浏览器 IO（行读取、编码检测、ZIP、fflate 打包、下载）。
- `src/composables/`：文本/漫画扫描、导出状态与消息。
- `src/components/`：页面展示组件。
- `src/config/limits.ts`：文件大小、分块与预览数量限制。
- `vite.config.ts`：Vue、UnoCSS 插件与生产分包配置。
- `vitest.config.ts`：测试与覆盖率配置。
- `netlify.toml`：Netlify 构建、缓存与安全头配置。
- `README.md`：用户使用说明、命令与支持范围。
- `docs/ARCHITECTURE.md`：分层边界、数据流、错误模型与确定性约定。
- `docs/REWRITE-PLAN.md`：重构进度、依赖决策与验证记录。

## 文件与职责边界

实现阶段必须遵守：

- 纯逻辑放到 `src/domain/`，浏览器 IO 放到 `src/services/`，状态编排放到 `src/composables/`；`App.vue` 只负责组合。
- Epub Generate 只做客户端逻辑，不要引入 Node 专用 API（如 `fs`、`path`、`Buffer`）。
- 文件读取必须走 `readFileLines` 之类的流式入口，不要一次性把大文件完整读进内存再按行切分。
- 编码支持范围以 `EncodingList` 为准；新增编码必须同时补充别名映射，并确认浏览器 `TextDecoder` 可用。
- EPUB 结构约定必须保持：
  - `mimetype` 必须是第一个文件且不压缩（`compression: "STORE"`）。
  - 必须包含 `META-INF/container.xml`，并指向 `OEBPS/content.opf`。
  - 始终生成 `OEBPS/toc.ncx` 与 `OEBPS/nav.xhtml`，并在 `content.opf` 中声明。
  - 多级标题的嵌套关系必须在预览、`nav.xhtml`、`toc.ncx` 中保持一致，并写入正确的 `dtb:depth`。
  - 无章节匹配的短篇文本按单章「正文」输出；首个标题前的内容记为「前言」。
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

纯文档改动例外：如果本次只改了 `README.md`、`docs/**`、`AGENTS.md` 等文档，
没有任何源码、配置、依赖锁文件或构建脚本变动，可以不手动运行 `pnpm check`，
并在提交说明或回复中注明未运行校验。混合改动仍必须运行完整校验。
Husky 的 pre-commit 仍会自动执行检查。

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

- 测试使用 Vitest（Node 环境），当前覆盖 `src/domain/**` 与 `src/services/**`；领域层按文件要求行/分支/函数/语句覆盖率 ≥ 90%，服务层重点路径全覆盖并纳入全局阈值。
- 新增测试时优先覆盖：编码检测与别名归一化、分块读取行、多级章节切分与层级归一化、漫画图片排序、嵌套 nav/ncx 与 EPUB 结构生成。
- 常用命令：`pnpm test`、`pnpm test:coverage`、`pnpm test:watch`。
- 涉及交互或浏览器行为时，应验证：
  - 上传 TXT/MD 后能自动检测编码并预览前 200 行。
  - 修改章节正则后目录识别数量实时更新，多级标题在目录中按层级缩进。
  - 上传 ZIP 后能看到前 20 张图片预览，图片顺序正确。
  - 生成 EPUB 后文件能正常打开，目录与章节/页面数量正确。
  - 切换到无效正则或空文件时有明确提示，不出现未捕获异常。
- 每次启动 Playwright MCP 做浏览器验证，都必须新建独立的项目根目录 `.playwright-mcp/<时间>/` 记录目录，保存截图、日志与录屏。
- 验证结束先关闭页面/浏览器让录屏落盘，再写 `verification.log`；关闭浏览器。
- 之前任何验证目录都是证据，严禁覆盖、更新、删除或移动其中文件。
- 截图前等待入场动画结束（至少 500ms），或启用 `reducedMotion: "reduce"`，避免截到半透明中间帧。
- 录屏只作本地证据，不默认交给模型分析；确需分析时只抽取 3–5 个关键帧，禁止逐帧读取整段视频。

## 文档优先

当新增或修改以下能力时，应同步更新 `README.md`：

- 支持的输入格式、编码、章节正则规则。
- 文本模式与漫画模式的行为差异。
- EPUB 输出结构或兼容性说明。
- 构建、测试、校验命令的变化。
- 分层边界、数据流或 EPUB 结构的变化，同步更新 `docs/ARCHITECTURE.md`。

重构进度、架构决策和依赖清单以 `docs/REWRITE-PLAN.md` 为准；每完成一个阶段必须同步更新该文档的进度与验证结果。

文档和实现发生冲突时，必须在提交前统一；不能让文档长期描述不存在或相反的行为。

## 依赖约束

优先使用成熟 npm 库，不要重复实现已有可靠方案。但新增运行时依赖必须经过用户明确同意。

新增依赖前必须给出：

- 解决什么问题。
- 为什么现有浏览器 API 或已安装依赖不足。
- 2–3 个候选包（至少一个推荐项），包含周下载量、gzip 体积、最后发布时间、优缺点和替代方案。
- 对包体积、启动性能、构建速度和维护成本的影响。
- 是否会读取、上传或处理用户的书籍文件与图片。

补充规则：

- 只有用户确认“用/用哪个”之后才能安装。
- 依赖决策记录在 `docs/REWRITE-PLAN.md` 第 9 节，实施过程中增删依赖也要同步更新。
- 未经用户允许，不得添加会上传本地数据、采集用户行为、接入远程服务或改变隐私边界的依赖。

## 协作礼仪

- 不擅自重构无关文件。
- 不覆盖用户未提交改动。
- 不因为构建失败就回滚用户改动。
- 遇到需求不明确时，优先做小范围、可解释、可回退的改动。
- 输出结论时说明改了哪些文件、没有改哪些文件、是否运行了验证。
