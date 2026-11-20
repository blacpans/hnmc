# システム全体アーキテクチャ設計書 (hnmc)

本ドキュメントは、「Hacker News × Gemini API × microCMS × Astro × Cloudflare」を統合した半自動テックニュース・キュレーションメディア（**Hacker news Hot Trends**）の全体設計をまとめたものである。

---

## 1. システム概要

毎朝 8:00 (JST) に Cloudflare Workers の Cron Triggers から GitHub Actions を起動し、Hacker News のトレンド記事（スコア上位 3 件）を自動取得して Gemini API で日本語要約を生成、microCMS に下書き（draft）として登録する。
登録完了時に Discord へ通知を飛ばし、ユーザーがスマホからワンタップで microCMS の編集画面を開いて「ひとこと」を添えて公開できる半自動キュレーション基盤である。
記事公開時は Webhook 経由で Astro（SSG）が Cloudflare Pages へ自動ビルド＆デプロイされ、超高速な Web サイトとして世界へ配信される。

---

## 2. システム全体アーキテクチャ図

```mermaid
flowchart TD
    %% 外部データソース & AI
    subgraph ExternalSources ["外部データソース & AI基盤"]
        HN["🔥 Hacker News API<br/>(Firebase: トップ記事取得)"]
        Web["🌐 元記事 Webサイト<br/>(HTML: OGP / Description抽出)"]
        Gemini["🤖 Google Gemini API<br/>(gemini-flash-lite-latest: 構造化要約)"]
    end

    %% 定時起動 & バッチシステム
    subgraph BatchSystem ["定時起動 & バッチ処理 (完全サーバーレス)"]
        CFWorker["⏰ Cloudflare Workers<br/>(Cron Triggers: 毎朝8時 JST)"]
        GHA["⚡ GitHub Actions<br/>(workflow_dispatch)"]
        Script["📦 同期スクリプト<br/>(TypeScript / tsx)"]
        CFWorker -->|REST APIで起動| GHA
        GHA --> Script
    end

    %% ヘッドレスCMS
    subgraph HeadlessCMS ["コンテンツ管理基盤"]
        MicroCMS[("📦 microCMS<br/>[news API]<br/>status: draft / published")]
    end

    %% モバイル通知 & キュレーション
    subgraph MobileCuration ["モバイル通知 & 人間キュレーション"]
        Discord["💬 Discord<br/>(Incoming Webhook)"]
        Smartphone["📱 キュレーター (先輩)<br/>(スマホブラウザで直リンク表示)"]
        Discord -->|編集リンクをタップ| Smartphone
        Smartphone -->|ひとこと追記 & 公開| MicroCMS
    end

    %% フロントエンド配信
    subgraph WebHosting ["フロントエンド & 静的ホスティング"]
        Webhook["🔔 microCMS Webhook<br/>(公開イベント検知)"]
        DeployHook["🚀 Cloudflare Pages<br/>(Deploy Hook)"]
        AstroSite["✨ Astro Webサイト<br/>(ダークモードUI / 日付別10日ページネーション)"]
        
        MicroCMS -->|コンテンツ公開時のみ発火| Webhook
        Webhook --> DeployHook
        DeployHook -->|SSGビルド実行| AstroSite
        AstroSite -->|ビルド時記事取得| MicroCMS
    end

    %% データ連携フロー
    Script -->|1. 上位20件取得 & スコア上位3件厳選| HN
    Script -->|2. メタデータ取得| Web
    Script -->|3. 日本語タイトル & 3行要約生成| Gemini
    Script -->|4. 重複排除チェック & 下書き入稿| MicroCMS
    Script -->|5. 編集直リンク付き通知| Discord
```

---

## 3. 記事ライフサイクル（状態遷移図）

```mermaid
stateDiagram-v2
    [*] --> 未取得: Hacker News上に記事が投稿される
    未取得 --> 重複チェック: Cloudflare Workers が毎朝8時に起動
    重複チェック --> スキップ: 既に microCMS に登録済み (hnId一致)
    スキップ --> [*]
    
    重複チェック --> スコア厳選: 未登録記事を収集 (最大20件スキャン)
    スコア厳選 --> 要約生成中: スコア上位3件を抽出
    要約生成中 --> 下書き登録完了: Gemini APIで日本語タイトル&3行要約生成
    下書き登録完了 --> 通知送信済み: microCMSに下書き(draft)POST & Discord通知
    
    state "人間によるキュレーション" as Curation {
        通知送信済み --> スマホで確認: 先輩がDiscord通知をタップ
        スマホで確認 --> コメント追記: microCMS編集画面でひとこと記入
        コメント追記 --> 公開: 「公開」ボタンを押下！
    }
    
    公開 --> Webhook発火: microCMSが公開イベントを通知
    Webhook発火 --> ビルド中: Cloudflare Pages でデプロイ開始
    ビルド中 --> サイト公開完了: Astro SSG サイトに反映
    サイト公開完了 --> [*]
```

---

## 4. 処理シーケンス図

```mermaid
sequenceDiagram
    autonumber
    actor CFWorker as Cloudflare Workers (Cron)
    participant GHA as GitHub Actions
    participant Script as 同期スクリプト
    participant HN as Hacker News API
    participant Target as 元記事Web
    participant Gemini as Gemini API
    participant CMS as microCMS
    participant Discord as Discord (スマホ通知)
    actor User as 先輩 (スマホ)
    participant Hosting as Cloudflare Pages (Astro)

    Note over CFWorker: 毎朝8:00 (JST) 定期起動
    CFWorker->>GHA: POST workflow_dispatch (sync-hn.yml)
    GHA->>Script: スクリプト実行 (npm start / tsx)
    Script->>HN: GET /v0/topstories.json
    HN-->>Script: 記事IDリスト [id1, id2, ...]

    loop 候補20件を走査して未登録記事を収集
        Script->>CMS: GET /news?filters=hnId[equals]{id} (重複チェック)
        alt 登録済み
            Script-->>Script: スキップ
        else 未登録
            Script->>HN: GET /v0/item/{id}.json (詳細・スコア取得)
            HN-->>Script: { title, url, score, ... }
        end
    end

    Note over Script: スコア降順で上位3件に厳選
    loop 厳選した上位3件
        opt 元記事URLが存在する場合
            Script->>Target: GET HTML (OGP/meta description抽出)
            Target-->>Script: メタデータ文字列
        end
        Script->>Gemini: POST generateContent (Structured Outputs)
        Gemini-->>Script: { jaTitle, summary }
        Script->>CMS: POST /news?status=draft (下書き登録)
        CMS-->>Script: 201 Created (contentId)
        Script->>Discord: Incoming Webhook (直リンクURL付き通知)
    end

    Note over Discord,User: スマホにプッシュ通知が届く
    User->>Discord: 通知内の「編集画面を開く」リンクをタップ
    User->>CMS: 編集画面でひとこと記入 ＆ 「公開」ボタン押下
    CMS->>Hosting: Webhook POST (公開時のみトリガー)
    Hosting->>CMS: GET /news (公開済み最新記事一覧)
    CMS-->>Hosting: 記事データ
    Hosting->>Hosting: Astro SSG ビルド＆静的デプロイ
    Note over Hosting: サイトの更新が完了！
```

---

## 5. microCMS スキーマ定義（ER図 & 詳細）

```mermaid
erDiagram
    NEWS_ITEM {
        string hnId PK "Hacker News ID (重複入稿防止キー)"
        string title "原題タイトル (英語原文)"
        string jaTitle "日本語タイトル (Gemini翻訳)"
        string aiSummary "AI要約 (Geminiによる3行要約)"
        string url "元記事URL"
        number score "取得時スコア (Points)"
        string comment "ひとこと (先輩が入力・任意)"
        string status "microCMS状態 (draft / published)"
        datetime publishedAt "公開日時"
    }
```

| フィールドID | 表示名 | 種類 | 必須 | 備考 |
|---|---|---|:---:|---|
| `hnId` | Hacker News ID | テキストフィールド | ○ | 重複入稿防止キー（一意） |
| `title` | 原題タイトル | テキストフィールド | ○ | 英語の元タイトル |
| `jaTitle` | 日本語タイトル | テキストフィールド | ○ | Geminiによる翻訳タイトル |
| `aiSummary` | AI要約 | テキストエリア | ○ | Geminiによる3行箇条書き要約 |
| `url` | 記事URL | テキストフィールド | ○ | 元記事への外部リンク |
| `score` | スコア | 数字 | ○ | 取得時点のポイント（Points） |
| `comment` | ひとこと | テキストエリア | × | 先輩が公開前に書き込むコメント欄 |

---

## 6. 設計のこだわりポイント

1. **確実な定時起動（Cloudflare Workers × GitHub Actions）**:
   - GitHub Actions 標準 `schedule` の遅延・ドロップを回避するため、Cloudflare Workers の Cron Triggers から `workflow_dispatch` API を叩く構成を採用。
2. **スマホ完結のキュレーション体験 & 負荷軽減**:
   - スコア上位 3 件に厳選することでキュレーション負担と API クォータ消費を抑制し、`contentId` 直リンク通知でワンタップ公開を実現。
3. **堅牢性とフェイルソフト設計**:
   - `neverthrow` + `Zod` による境界の型安全性、HTTP 30秒タイムアウト、3回連続失敗時のサーキットブレーカー、完全失敗時の Discord アラート通知を実装。
4. **安全なスクレイピングと著作権配慮**:
   - 元記事の本文は一切保持せず、ヘッダー（OGP/meta description）のみを取得して要約材料とし、元記事URLへのリンクを明記。
5. **完全無料枠での運用**:
   - Cloudflare Workers、GitHub Actions、Gemini (`gemini-flash-lite-latest`) 無料枠、microCMS Hobbyプラン、Cloudflare Pagesを活用。
