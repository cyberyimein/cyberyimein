# Experiment：Search で発見し、Fetch で根拠を読む

このカードは、自作の Search → Fetch ツールチェーンだけを記録するものから、同じ Web 検索能力を複数バックエンドで比較するものへ更新した。自作の `web_search` と `web_fetch` は、制御しやすく再実行しやすい経路として残る。そこに OpenRouter の `openrouter:web_search` server tool と、Responses API の一回の呼び出しで `web_search` を追加するモデルネイティブ検索を加えた。三つの経路はいずれもソース情報を保持できるが、中間証拠、呼び出しのタイミング、統制の境界は異なる。

## 検証課題

Agent に必要なのは、Web 上の回答だけではない。ソース、根拠の境界、リアルタイム性・コスト・再検証性の選択肢も必要になる。以前の実験は Search と Fetch を分離する方法を問うものだった。今回の更新では、違いをブラックボックスに隠さず、一つの検索契約に自作、マネージド、モデルネイティブのバックエンドを収められるかを問う。

## 方法

第一の経路は自作実装を維持する。`web_search` が DuckDuckGo HTML から候補ソースを発見し、`web_fetch` が選択した公開アドレスを読み、Markdown に変換する。ツール呼び出し、プロバイダー、処理時間、失敗理由は Web Activity trace に記録し続ける。

第二の経路は OpenRouter を使う。`tools: [{ "type": "openrouter:web_search" }]` を指定すると、モデルが必要なときに Web 検索を要求できる。OpenRouter は設定された provider ネイティブ検索または別の検索エンジンを選び、共通形式の URL citation を返す。これはマネージドな検索入口であり、ページ単位の Fetch をそのまま置き換えるものではない。

OpenRouter の旧 `web` plugin / `:online` 入口は互換性の背景としてのみ残し、公式ドキュメントでも deprecated とされている。新しいアダプターは推奨される server tool 経路で記録する。

第三の経路はモデルネイティブ検索である。Responses API の `tools` に `{ "type": "web_search" }` を加えるだけで、検索するか、検索を続けるかをモデルが判断し、response にソース注釈を付ける。Azure OpenAI / Foundry の同様の Responses API Web Search を使う場合、その基盤は Grounding with Bing である。これは OpenRouter の検索エンジンと混同せず、独立した Bing grounding アダプターとして記録する。

三つの経路では、比較可能な retrieval trace として `backend`、query/queries、source URLs、citations、latency、cost、failure を共通記録する設計にする。全文や凍結した根拠が必要なら明示的な Fetch に戻り、引用付きの最新回答だけが必要ならマネージドまたはモデルネイティブ経路を選ぶ。

## 結果

今回の更新は、どれか一つのバックエンドを勝者とするものではない。能力の境界を明確にした。

- 自作 Search + Fetch は query、候補結果、ページ本文を公開する。ポリシー制御、再実行、根拠の凍結に向く一方、クローリング、SSRF 防御、レート制限を自分で扱う必要がある。
- OpenRouter はマネージドな入口と正規化された URL citation を提供し、provider や検索エンジンを切り替えやすい。その代わり、検索過程と生のコンテキストの制御粒度は低い。
- Responses API Web Search はツール付きの一回の呼び出しに統合でき、最新情報を引用付きで得る用途に向く。ただし、自動的に再実行できる Fetch 文書とみなしてはいけない。

したがって、`Search & Fetch` は明示的で監査可能な根拠取得経路として残す。OpenRouter と Responses API は同じ Harness 能力の下に置くマネージド／ネイティブのバックエンドであり、意味が完全に同じ代替品ではない。

## 制約

現時点では provider 横断の品質、レイテンシ、コストのベンチマークはないため、どの経路が普遍的に優れるとは言えない。検索順位、コンテキスト量、citation の形式、モデルが検索を開始するかどうかは provider、モデル、API 版によって変わり、OpenRouter の server tool も beta である。ネイティブ検索は通常ソース注釈を保証するだけで、取得した生ドキュメントをアプリへ渡すとは限らない。Azure Grounding with Bing には独自のサービス境界と表示要件がある。自作経路も DuckDuckGo のチャレンジ／レート制限、公開アドレス制限、Crawl4AI フォールバックの設定に左右される。

## その後への影響

Anomalo Harness の Web 接続は、`custom_search_fetch`、`openrouter_web_search`、`responses_web_search` という交換可能な `web_retrieval` アダプターとして公開するべきだ。共通の trace とソースモデルを持たせ、タスクのポリシーがバックエンドを選ぶ。これにより、花見 CLI から続く外部ツールの経験を保ちながら、すべての Web 回答を同じ自作クローラーに通す必要がなくなる。

Urus のような株式リサーチ Agent では、マネージドまたはモデルネイティブ検索で最新ニュースやマクロ情報を先に発見し、研究結論を出す前に重要なページやデータを追跡可能な根拠として凍結できる。検索バックエンドの選択は、Harness のハードコードされた前提ではなく、研究フローのポリシーになる。
