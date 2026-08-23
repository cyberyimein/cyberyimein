# Experiment: Search for discovery, Fetch for evidence

This card has been updated from a self-built Search → Fetch tool chain to a multi-backend comparison of the same web-retrieval capability. The custom `web_search` and `web_fetch` tools remain the most controllable and replayable path. The card now also covers OpenRouter's `openrouter:web_search` server tool and model-native web search, enabled by adding a `web_search` tool to a single Responses API call. All three routes can preserve source information, but they expose different intermediate evidence, call timing, and governance boundaries.

## Question

An Agent needs more than an answer found on the web: it needs sources, an evidence boundary, and a way to choose between freshness, cost, and replayability. The original experiment asked how to split Search and Fetch. This update asks how one retrieval contract can host custom, managed, and model-native backends without hiding their differences inside a black box.

## Method

The first path keeps the custom implementation. `web_search` uses DuckDuckGo HTML to discover candidate sources, while `web_fetch` reads a selected public target and converts it to Markdown. Tool calls, providers, timings, and failure causes continue to be written to the Web Activity trace.

The second path uses OpenRouter: `tools: [{ "type": "openrouter:web_search" }]` lets the model request web search when needed. OpenRouter selects a provider-native search or another configured engine and returns URL citations through a common response shape. It is a managed retrieval entry point, not a drop-in replacement for page-by-page Fetch.

OpenRouter's older `web` plugin / `:online` entry point is kept only as compatibility context and is documented as deprecated; the new adapter follows the recommended server-tool path.

The third path uses model-native retrieval. The Responses API only needs `{ "type": "web_search" }` in its `tools` list; the model decides whether to search and whether to continue searching, and the response carries source annotations. When the analogous Responses API web search is provided by Azure OpenAI / Foundry, its underlying service is Grounding with Bing. That is recorded as a separate Bing-grounding adapter rather than conflating it with OpenRouter's search engines.

The three paths should write a comparable retrieval trace: `backend`, query/queries, source URLs, citations, latency, cost, and failure. When full text or frozen evidence is required, the system still returns to explicit Fetch; when a current answer with citations is enough, a managed or model-native route is appropriate.

## Result

The update does not declare one backend the winner. It makes the capability boundaries explicit:

- Custom Search + Fetch exposes the query, candidate results, and page body. It is the best fit for policy control, replay, and evidence freezing, but it carries the cost of crawling, SSRF protection, and rate-limit handling.
- OpenRouter provides a managed entry point and normalized URL citations, making provider or engine changes easier; the trade-off is less control over the search process and raw context.
- Responses API web search compresses integration into one tool-enabled call and is useful for current, cited answers; it should not be treated as a Fetch document that can automatically be replayed.

`Search & Fetch` therefore remains the explicit, auditable evidence path. OpenRouter and Responses API become managed/native backends under the same Harness capability, not semantically identical replacements.

## Limitations

There is no cross-provider benchmark for quality, latency, or cost yet, so this card does not claim that one route is universally better. Ranking, context size, citation shape, and the model's decision to search vary by provider, model, and API version; OpenRouter's server tool is also still in beta. Native retrieval generally guarantees source annotations rather than raw retrieved documents, and Azure Grounding with Bing has its own service-boundary and display requirements. The custom path still faces DuckDuckGo challenges or rate limits, public-target restrictions, and the need for a configured Crawl4AI fallback.

## Subsequent Impact

The Anomalo Harness should expose web access through replaceable `web_retrieval` adapters: `custom_search_fetch`, `openrouter_web_search`, and `responses_web_search`. They share one trace and source model, while task policy chooses the backend. This preserves the external-tool experience carried forward from Hanami CLI without requiring every web answer to pass through the same custom crawler.

For a stock-research Agent such as Urus, managed or model-native search can discover current news and macro information first; before a research conclusion is published, key pages or data should be frozen as traceable evidence. Retrieval backend choice becomes a research policy, not a hard-coded Harness assumption.
