# AnomaloHaris: Turning an Agent Runtime into a Local Compute Center

AnomaloHaris, formerly Anomalo, is my personal AI engineering laboratory and a local AI compute center for other agent services. Instead of keeping the Python backend, device integrations, media stack, and domain modules in one process, it now focuses on a controlled, observable, and versioned Node.js/TypeScript agent runtime.

## Why the project was redefined

The early Anomalo prototype combined the Agent Harness, StackChan, voice, vision, stock research, and a Python sandbox. That was useful for fast experiments, but the runtime boundary became unclear as more models and tools were added. A caller could not easily tell which prompt, model, tools, or state a request actually used.

AnomaloHaris now has a narrower question: how can model calls, context assembly, tool execution, Sessions, and event streaming become one local service while other agents select a capability with only a stable name and version?

## Current architecture

- **Node Host**: `apps/node-host` owns HTTP, the OpenAI-compatible API, WebSocket, AgentCore, RunController, Sessions, Providers, and the plugin runtime.
- **Preset Models**: `name@version` is the only external capability unit. It fixes the prompt, Provider Model, credential reference, tool protocol, plugin graph, and runtime policy.
- **Resource bundle**: `runtime-bundle` contains prompts, Skills, MCP/plugin configuration, deployment scripts, and the compiled frontend. It is not a second backend.
- **Optional Buddy plugin**: the Buddy service and `buddy-bridge` run separately. Device control, Hook Relay, and approvals enter through a plugin boundary instead of the Node Host core.
- **Frontend control panel**: the Vue UI exposes model identity, context, tool calls, web sources, errors, and Session state.

The default Agent is also a Preset Model: `anomalo@1`. Callers may omit the model reference and use the configured default, or select a published version explicitly with `name@version`. Every entry point eventually uses the same AgentCore; there is no special Agent runtime outside the Registry.

## How a Run works

At the start of a Run, the Node Host freezes the static context snapshot: Prompt, Memory, `AGENTS.md`, the Skill catalog, and the MCP catalog. During tool execution it refreshes only resources and tools that are intentionally dynamic, so a Run cannot silently switch its system context after an external configuration change.

Model requests, tool start and finish, web traces, errors, stop, and resume are normalized into shared typed events. Sessions store the Node runtime's message chain, Preset Model binding, and checkpoint. Old Python Session data is not migrated and is not a compatibility requirement for the new runtime.

## Current boundaries

Web Search, Web Fetch, and host-core are core tools. Browser, MCP, and Buddy are optional plugins introduced behind explicit capability boundaries; an unavailable plugin is reported as degraded or unavailable instead of disappearing silently.

Audio, vision, camera, and heavyweight media processing are no longer built into AnomaloHaris. Stock research is no longer retained as a legacy Node Host module either. Domain agents can use AnomaloHaris compute through the OpenAI-compatible API or the native API.

## Current status

The Node-only version is built and deployed to an Apple Container on the Mac mini. External services can use `/v1/chat/completions`; the local UI and scripts can use `/api/chat`, NDJSON, WebSocket, or the Native Run API. Preset Models, the tool catalog, health checks, and frontend assets have passed local and remote smoke tests.

The next step is to deepen real Provider tool-call validation, plugin isolation, and Buddy's independent lifecycle while keeping the core Host small and stable.

## Technology stack

Node.js / TypeScript / Fastify / Vue 3 / SQLite / OpenRouter / OpenAI-compatible API / WebSocket / Apple Container
