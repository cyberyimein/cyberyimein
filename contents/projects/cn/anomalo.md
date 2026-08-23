# AnomaloHaris：把 Agent 运行时做成本地算力中心

AnomaloHaris（原 Anomalo）是我的个人 AI 工程实验室，也是其他本地 Agent 服务可以直接调用的 AI 算力中心。它不再把 Python 后端、设备能力和业务模块堆在同一个进程里，而是用 Node.js/TypeScript 构建一个受控、可观察、可版本化的 Agent 运行时。

## 为什么重新定义

早期 Anomalo 同时承载 Agent Harness、StackChan、语音、视觉、股票研究和 Python 沙箱。这样的原型适合快速验证，但随着工具和模型增多，运行时边界变得模糊：调用者很难知道一次请求实际使用了什么 Prompt、模型、工具和状态。

现在 AnomaloHaris 的核心问题更明确：如何把模型调用、上下文组装、工具执行、Session 和事件流集中成一个本地服务，同时让外部 Agent 只需要一个稳定的模型名称和版本号。

## 当前架构

- **Node Host**：`apps/node-host` 负责 HTTP、OpenAI-compatible API、WebSocket、AgentCore、RunController、Session、Provider 和插件运行时。
- **Preset Model**：`name@version` 是对外的唯一能力单位。它固定 Prompt、Provider Model、凭据引用、工具协议、插件图和运行策略。
- **资源包**：`runtime-bundle` 保存 Prompt、Skill、MCP/插件配置、部署脚本和编译后的前端静态文件，不再是一个独立后端。
- **可选 Buddy 插件**：Buddy service 与 `buddy-bridge` 分开运行。设备控制、Hook Relay 和审批通过插件接入，不进入 Node Host 核心。
- **前端控制面板**：Vue UI 显示模型身份、上下文、工具调用、Web 来源、错误和 Session 状态。

默认 Agent 也是一个 Preset Model：`anomalo@1`。调用者可以省略模型引用使用默认版本，也可以通过 `name@version` 精确选择一个已发布版本。不同入口最终都进入同一个 AgentCore，不再存在 Registry 之外的特殊 Agent runtime。

## 一次 Run 如何工作

Run 开始时，Node Host 冻结 Prompt、Memory、`AGENTS.md`、Skill catalog 和 MCP catalog 的静态上下文快照。工具执行期间只刷新原本动态的资源和工具列表，因此一次 Run 不会因为外部修改配置而突然更换 system context。

模型请求、工具开始与结束、Web trace、错误、停止和恢复都会转换成共享的类型化事件。Session 保存的是 Node 运行时自己的消息链、Preset Model 绑定和 checkpoint；旧 Python Session 数据不再迁移，也不是新运行时的兼容负担。

## 当前边界

Web Search、Web Fetch 和 host-core 是核心工具。Browser、MCP 和 Buddy 作为可选插件逐步接入；插件不可用时必须明确显示 degraded 或 unavailable。

音频、视觉、摄像头和重量级媒体处理不再内置在 AnomaloHaris。股票研究也不再作为 Node Host 的遗留模块保留，领域 Agent 可以通过 OpenAI-compatible API 或 Native API 使用 AnomaloHaris 的模型算力。

## 当前状态

Node-only 版本已经构建并部署到 Mac mini 的 Apple Container。外部服务可以使用 `/v1/chat/completions`，本地 UI 和脚本可以使用 `/api/chat`、NDJSON、WebSocket 或 Native Run API。Preset Model、工具目录、健康检查和前端静态资源均已通过本地与远端 smoke test。

下一步是继续完善真实 Provider 的工具调用验证、可选插件的隔离和 Buddy 的独立生命周期，同时保持核心 Host 小而稳定。

## 技术栈

Node.js / TypeScript / Fastify / Vue 3 / SQLite / OpenRouter / OpenAI-compatible API / WebSocket / Apple Container
