# システム全体アーキテクチャ設計書 (hnmc)

本ドキュメントは、「Hacker News × Gemini API × microCMS × Astro」を統合した半自動テックニュース・キュレーションメディアの全体設計をまとめたものである。

---

## 1. システム概要

毎朝Hacker Newsのトレンド記事を自動取得し、Gemini APIで日本語要約を生成した上でmicroCMSに下書きとして登録する。
登録完了時にSlack（またはDiscord）へ通知を飛ばし、ユーザーがスマホからワンタップでmicroCMSの編集画面を開いてひとことコメントを添えて公開できる半自動キュレーション基盤である。
記事公開時はWebhook経由でAstro（SSG）が自動ビルド＆デプロイされ、高速なWebサイトとして閲覧可能になる。

---

## 2. 全体アーキテクチャ図

### Mermaid 図（GitHub / Qiita ネイティブ対応）

```mermaid
graph TD
    subgraph DataSources ["外部データソース & AI"]
        HN["Hacker News API<br/>(Firebase)"]
        Web["元記事Webサイト<br/>(OGP / メタデータ)"]
        Gemini["Google Gemini API<br/>(gemini-2.5-flash / Structured Outputs)"]
    end

    subgraph BatchSystem ["バッチ処理 (定期実行)"]
        GHA["GitHub Actions<br/>(Cron: 毎日朝8時 JST)"]
        SyncScript["同期スクリプト<br/>(Node.js / TypeScript)"]
        GHA --> SyncScript
    end

    subgraph HeadlessCMS ["コンテンツ管理基盤"]
        MicroCMS["microCMS<br/>(news API: draft状態)"]
    end

    subgraph NotificationAndUser ["通知 & 人間キュレーション"]
        Slack["Slack / Discord<br/>(Incoming Webhook)"]
        UserPhone["スマホブラウザ<br/>(microCMS編集画面)"]
        Slack -->|編集リンクタップ| UserPhone
        UserPhone -->|コメント追記 & 公開| MicroCMS
    end

    subgraph FrontendAndHosting ["フロントエンド & デプロイ"]
        Webhook["microCMS Webhook<br/>(公開トリガー)"]
        Hosting["Cloudflare Pages / Vercel<br/>(Build & Hosting)"]
        AstroSite["Astro Webサイト<br/>(SSG / カードUI)"]
        MicroCMS -->|公開イベント| Webhook
        Webhook --> Hosting
        Hosting --> AstroSite
    end

    SyncScript -->|1. トレンド記事ID取得| HN
    SyncScript -->|2. メタデータ取得| Web
    SyncScript -->|3. タイトル翻訳 & 3行要約生成| Gemini
    SyncScript -->|4. 重複チェック & 下書き入稿| MicroCMS
    SyncScript -->|5. 編集直リンク付き通知| Slack
    AstroSite -->|ビルド時データ取得| MicroCMS
```

### PlantUML 図

```plantuml
@startuml
skinparam handwritten false
skinparam monochrome false
skinparam shadowing true
skinparam packageStyle rectangle

package "外部データソース & AI" {
    [Hacker News API] as HN
    [元記事 Webサイト] as Web
    [Google Gemini API] as Gemini
}

package "バッチ実行環境" {
    [GitHub Actions] as GHA
    [同期スクリプト (TypeScript)] as Script
    GHA ..> Script : 定期実行 (Cron)
}

package "ヘッドレスCMS" {
    database "microCMS" as CMS
}

package "モバイル通知 & キュレーション" {
    [Slack / Discord] as Chat
    actor "キュレーター (スマホ)" as User
}

package "フロントエンド配信" {
    [Webhook Dispatcher] as Hook
    [Astro SSG (Cloudflare / Vercel)] as WebApp
    interface "公開Webサイト" as PublicSite
}

Script --> HN : 1. 上位記事取得
Script --> Web : 2. OGP/説明文取得
Script --> Gemini : 3. 翻訳 & 要約リクエスト
Script --> CMS : 4. 下書き(draft)登録
Script --> Chat : 5. 直リンク付き通知送信

Chat --> User : プッシュ通知
User --> CMS : 6. コメント追記 & 公開操作
CMS --> Hook : 7. 公開Webhook発火
Hook --> WebApp : 8. デプロイフック起動
WebApp --> CMS : 9. 公開記事データ取得
WebApp --> PublicSite : 10. 静的配信
@enduml
```

---

## 3. 処理シーケンス図

### Mermaid シーケンス図

```mermaid
sequenceDiagram
    autonumber
    actor Cron as GitHub Actions
    participant Script as 同期スクリプト
    participant HN as Hacker News API
    participant Target as 元記事Web
    participant Gemini as Gemini API
    participant CMS as microCMS
    participant Slack as Slack (スマホ通知)
    actor User as 先輩 (スマホ)
    participant Hosting as ホスティング (Astro)

    Note over Cron: 毎朝8:00 (JST) 起動
    Cron->>Script: スクリプト実行
    Script->>HN: /v0/topstories.json 取得
    HN-->>Script: 記事IDリスト
    
    loop 上位記事 (例: 5件)
        Script->>CMS: GET /news?filters=hnId[equals]{id} (重複チェック)
        alt 登録済み
            Script-->>Script: スキップ
        else 未登録
            Script->>HN: /v0/item/{id}.json (詳細取得)
            HN-->>Script: タイトル, URL, スコア等
            opt 元記事URLあり
                Script->>Target: HTMLヘッダー取得 (OGP/Description)
                Target-->>Script: メタデータ
            end
            Script->>Gemini: 構造化要約プロンプト送信
            Gemini-->>Script: { jaTitle, summary }
            Script->>CMS: POST /news?status=draft
            CMS-->>Script: 201 Created (contentId)
            Script->>Slack: Incoming Webhook 送信 (直リンクURL含む)
        end
    end

    Note over Slack,User: スマホにプッシュ通知着信
    User->>Slack: 通知タップ (直リンク)
    User->>CMS: 編集画面でひとことコメント記入 ＆ 「公開」クリック
    CMS->>Hosting: Webhook発火 (on content published)
    Hosting->>CMS: GET /news (最新公開記事の取得)
    CMS-->>Hosting: 記事データ
    Hosting->>Hosting: Astro SSG ビルド＆静的デプロイ
    Note over Hosting: サイト更新完了！
```

### PlantUML シーケンス図

```plantuml
@startuml
autonumber
actor "GitHub Actions" as Cron
participant "同期スクリプト" as Script
participant "Hacker News API" as HN
participant "元記事" as Target
participant "Gemini API" as Gemini
participant "microCMS" as CMS
participant "Slack" as Slack
actor "キュレーター (先輩)" as User
participant "Astro / Hosting" as WebApp

Cron -> Script : 毎朝8時 ジョブ起動
Script -> HN : トップ記事ID取得
HN --> Script : ID一覧

loop 未登録の上位5件
    Script -> CMS : 既存hnIdの重複チェック
    alt 未登録の場合
        Script -> HN : 記事詳細取得
        HN --> Script : タイトル・URL・スコア
        Script -> Target : OGP・メタ情報取得
        Target --> Script : メタデータ
        Script -> Gemini : 翻訳・3行要約生成要求
        Gemini --> Script : 構造化JSON (jaTitle, summary)
        Script -> CMS : 下書き(draft)として登録
        CMS --> Script : contentId 返却
        Script -> Slack : 編集画面直リンク付き通知
    end
end

Slack -> User : スマホプッシュ通知
User -> CMS : 編集画面でコメント入力 & 「公開」ボタン押下
CMS -> WebApp : Webhook通知 (公開イベント)
WebApp -> CMS : 公開記事一覧取得
CMS --> WebApp : 記事データ
WebApp -> WebApp : SSGビルド & デプロイ完了
@enduml
```

---

## 4. microCMS スキーマ設計 (`news` API)

| フィールドID | 表示名 | 種類 | 必須 | 備考 |
|---|---|---|:---:|---|
| `hnId` | Hacker News ID | テキストフィールド | ○ | 重複入稿防止キー（一意） |
| `title` | 原題タイトル | テキストフィールド | ○ | 英語の元タイトル |
| `jaTitle` | 日本語タイトル | テキストフィールド | ○ | Geminiによる翻訳タイトル |
| `aiSummary` | AI要約 | テキストエリア | ○ | Geminiによる3行箇条書き要約 |
| `url` | 記事URL | テキストフィールド | ○ | 元記事への外部リンク |
| `score` | スコア | 数字 | ○ | 取得時点のポイント（Points） |
| `comment` | ひとこと解説 | テキストエリア | × | 先輩が公開前に書き込むコメント欄 |

---

## 5. 技術選定と考慮事項

1. **完全無料運用の実現**:
   - GitHub Actions: パブリックリポジトリなら実行無料（プライベートでも月2,000分枠内）
   - Gemini API: `gemini-2.5-flash` 無料枠（1日5件程度ならレート制限・コストともに余裕）
   - microCMS: Hobbyプラン（無料）の範囲内
   - Astro / Cloudflare Pages / Vercel: 無料プラン

2. **堅牢性とセキュリティ**:
   - microCMS APIキーをバッチ用（POST/GET権限）とフロント用（GET限定）で完全分離
   - Gemini APIの Structured Outputs (`responseSchema`) を使用し、JSONパースエラーを防止
   - 元記事スクレイピングはヘッダー（OGP/meta description）のみに絞り、著作権侵害を回避
