# AnomaloHaris：Agent ランタイムをローカル計算センターにする

AnomaloHaris（旧 Anomalo）は、私の個人 AI エンジニアリングラボであり、他の Agent サービスから直接利用できるローカル AI 計算センターでもある。Python バックエンド、デバイス連携、メディア処理、ドメインモジュールを一つのプロセスに集約するのではなく、制御可能で観測可能、かつバージョン管理された Node.js/TypeScript Agent ランタイムに集中している。

## なぜ再定義したのか

初期の Anomalo は、Agent Harness、StackChan、音声、ビジョン、株式リサーチ、Python サンドボックスを一つのプロトタイプにまとめていた。高速な検証には適していたが、モデルとツールが増えるにつれて実行境界が不明確になった。呼び出し側からは、実際にどの Prompt、モデル、ツール、状態が使われたのかを確認しにくかった。

AnomaloHaris が現在取り組む問題はより明確である。モデル呼び出し、コンテキスト構築、ツール実行、Session、イベントストリーミングを一つのローカルサービスに集約し、他の Agent からは安定した名前とバージョンだけで能力を選べるようにする。

## 現在のアーキテクチャ

- **Node Host**：`apps/node-host` が HTTP、OpenAI 互換 API、WebSocket、AgentCore、RunController、Session、Provider、プラグインランタイムを所有する。
- **Preset Model**：`name@version` が外部向けの唯一の能力単位である。Prompt、Provider Model、認証情報参照、ツールプロトコル、プラグイングラフ、実行ポリシーを固定する。
- **Resource bundle**：`runtime-bundle` は Prompt、Skill、MCP/プラグイン設定、デプロイスクリプト、コンパイル済みフロントエンドを保持する。第二のバックエンドではない。
- **任意の Buddy プラグイン**：Buddy service と `buddy-bridge` は分離して動作する。デバイス制御、Hook Relay、承認はプラグイン境界から接続し、Node Host のコアには組み込まない。
- **フロントエンド**：Vue UI でモデルの識別情報、コンテキスト、ツール呼び出し、Web ソース、エラー、Session 状態を確認できる。

デフォルト Agent も Preset Model の一つであり、`anomalo@1` として提供する。呼び出し側はモデル参照を省略して既定版を使うことも、`name@version` で公開済みの版を明示することもできる。すべての入口は同じ AgentCore を使い、Registry の外側に特別な Agent runtime は存在しない。

## Run の流れ

Run の開始時に、Node Host は Prompt、Memory、`AGENTS.md`、Skill catalog、MCP catalog から静的コンテキストのスナップショットを作る。ツール実行中は意図的に動的なリソースとツールだけを更新するため、外部設定の変更によって同じ Run の system context が途中で変わることはない。

モデルリクエスト、ツールの開始・終了、Web trace、エラー、停止、再開は共有された型付きイベントへ正規化される。Session には Node ランタイムのメッセージチェーン、Preset Model の binding、checkpoint を保存する。旧 Python Session データは移行せず、新ランタイムの互換条件にも含めない。

## 現在の境界

Web Search、Web Fetch、host-core はコアツールである。Browser、MCP、Buddy は明示的な能力境界を持つ任意プラグインとして追加する。利用できないプラグインは黙って消すのではなく、degraded または unavailable として表示する。

音声、ビジョン、カメラ、重量級メディア処理は AnomaloHaris に内蔵しない。株式リサーチも Node Host の旧モジュールとして残さず、必要なドメイン Agent が OpenAI 互換 API または Native API 経由で AnomaloHaris の計算能力を利用する。

## 現在の状態

Node-only 版はビルドされ、Mac mini の Apple Container にデプロイされている。外部サービスは `/v1/chat/completions` を利用でき、ローカル UI とスクリプトは `/api/chat`、NDJSON、WebSocket、Native Run API を利用できる。Preset Model、ツールカタログ、ヘルスチェック、フロントエンド静的ファイルはローカルとリモートの smoke test を通過している。

次は、実 Provider のツール呼び出し検証、プラグイン隔離、Buddy の独立ライフサイクルを強化しつつ、コア Host を小さく安定させる。

## 技術スタック

Node.js / TypeScript / Fastify / Vue 3 / SQLite / OpenRouter / OpenAI 互換 API / WebSocket / Apple Container
