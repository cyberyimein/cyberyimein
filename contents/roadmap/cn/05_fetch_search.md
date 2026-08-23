# Experiment：Search 发现，Fetch 取证

这张卡片从“自制 Search → Fetch 工具链”更新为“同一联网检索能力的多后端对照”。自制的 `web_search` 与 `web_fetch` 仍提供最可控、可重放的路径；现在还可以接入 OpenRouter 的 `openrouter:web_search` server tool，以及模型原生 Web Search——通过 Responses API 的一次调用挂载 `web_search` 工具。三条路线都能保留来源信息，但暴露的中间证据、调用时机与治理边界并不相同。

## 问题

Agent 需要的不只是“搜到答案”，还要知道来源、保留证据边界，并在实时性、成本与可复盘之间做选择。原来的实验只回答“如何把 Search 和 Fetch 拆开”；这次更新要回答的是：同一套检索契约如何容纳自制、托管和模型原生三种后端，而不把它们的差异藏进一个黑盒。

## 方法

第一条路径保留自制实现：`web_search` 使用 DuckDuckGo HTML 发现候选来源，`web_fetch` 读取指定的公开地址并转换成 Markdown。两个工具的调用、提供方、耗时与失败原因继续写入 Web Activity trace。

第二条路径接入 OpenRouter：通过 `tools: [{ "type": "openrouter:web_search" }]` 让模型按需发起联网检索，OpenRouter 按配置选择 provider 原生搜索或其它搜索引擎，并把 URL citation 统一回传。它是托管的检索入口，不等同于自制的逐页 Fetch。

OpenRouter 旧的 `web` plugin / `:online` 入口只作为兼容背景保留，官方文档已将其标为 deprecated；新适配按推荐的 server tool 记录。

第三条路径使用模型原生检索：Responses API 只需在 `tools` 中加入 `{ "type": "web_search" }`，模型自行决定是否搜索以及是否继续搜索，最终 response 携带来源标注。若接入 Azure OpenAI / Foundry 的同类 Responses API，Web Search 的底层是 Grounding with Bing；这里把它记录为独立的 Bing grounding 适配器，而不是把 OpenRouter 的引擎实现混为一谈。

三条路径应统一写入可比较的 retrieval trace：`backend`、query/queries、source URLs、citations、latency、cost 与 failure。需要全文或冻结证据时，仍回到显式 `Fetch`；只需要带引文的最新回答时，可以选择托管或模型原生路径。

## 结果

本次更新的结果不是宣布某一个后端取代其它后端，而是把能力边界说清楚：

- 自制 Search + Fetch 暴露查询、候选结果和页面正文，最适合做策略控制、重放与证据冻结，但需要自行承担抓取、SSRF 防护和限流处理。
- OpenRouter 提供统一的托管入口和 URL citation，便于替换 provider 或搜索引擎；代价是搜索过程和原始上下文的控制粒度较低。
- Responses API 的模型原生检索把接入压缩为一次带工具的调用，适合快速获得带来源的实时回答；它不应被当作一份可自动重放的 Fetch 文档。

因此，`Search & Fetch` 仍是显式、可审计的取证路径；OpenRouter 与 Responses API 则作为同一 Harness 能力下的托管/原生检索后端，而不是语义完全相同的替代品。

## 局限

目前还没有跨 provider 的质量、延迟和成本基准，不能据此宣称某条路线普遍更好。搜索排序、上下文大小、引用格式和模型是否主动检索都会随 provider、模型与 API 版本变化；OpenRouter 的 server tool 也仍处于 beta。模型原生路径通常只保证来源标注，不保证把检索到的原始内容交给应用；Azure Grounding with Bing 还需要单独遵守其服务边界与展示要求。自制路径仍受 DuckDuckGo 挑战/限流、公开地址限制以及 Crawl4AI 配置的影响。

## 后续影响

Anomalo Harness 应把联网能力抽象成可替换的 `web_retrieval` 适配层：`custom_search_fetch`、`openrouter_web_search` 与 `responses_web_search` 共用同一份 trace 和来源模型，再由任务策略选择后端。这样既保留了花见 CLI 带来的外部工具经验，也不要求所有联网回答都经过同一套自制爬虫。

对 Urus 这样的股票研究 Agent，实时新闻和宏观信息可以先用托管或模型原生检索发现；进入研究结论前，再把关键页面或数据冻结为可追踪证据。检索后端因此成为研究流程的策略选择，而不是 Harness 的硬编码前提。
