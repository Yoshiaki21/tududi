# よしあき - tududi 個人設定

## マイグレーション命名規則
新規マイグレーションは必ず `yoshiaki21-` プレフィックスを付ける。
例: `yoshiaki21-20260601000001-description.js`
- ASCII順で上流マイグレーションの後に実行される
- 上流ファイルを直接修正する場合はファイル名を変更しない

## 実装上の共通ルール
- `safeAddColumns` のテーブル名は**小文字**で渡す（`'tasks'`, `'projects'`, `'users'`）
- 人工単価の優先順位: `project.unit_price ?? user.default_unit_price ?? 25000`
- 8時間 = 1人工
- Docker ベースイメージ: `node:22-trixie-slim`（glibc 2.40 必須）

## タスク状況
| # | タイトル | 状態 |
|---|---------|------|
| 1 | Markdownチェックボックス修正 ＋ ダブルクリック編集 | ✅完了 |
| 2 | Matrix 連携機能の実装 | ✅完了 |
| 3 | Markdownチェックボックス更新時の Toast 抑制 | ✅完了 |
| 4 | マイグレーション衝突回避プレフィックス導入 | ✅完了 |
| 5 | Dockerfile Alpine → Debian slim 移行 | ✅完了 |
| 6 | Dockerfile ベースイメージ trixie-slim に修正 | ✅完了 |
| 7 | Matrix E2EE 対応 | ✅完了 (2026-05-30) |
| 8 | matrixPoller.js Stop/Start 動作修正 | ✅完了 |
| 9 | MatrixTab UI改善 | ✅完了 |
| 10 | 工数管理機能追加 | ✅完了 (2026-05-31) |
| 11 | 人工単価入力欄スピナー非表示 | ✅完了 (2026-05-31) |
| 12 | プロジェクト概要欄をタブ切り替え式に変更 | ✅完了 (2026-05-31) |
| PR#3 | 共通MarkdownEditorコンポーネント（ツールバー＋画像D&D） | ✅完了 (2026-05-31) |
| PR#2 | プロジェクト添付ファイル機能 | ✅完了 (2026-05-31) |
| PR#4 | ノートに添付ファイルタブ追加 | ✅完了 (2026-05-31) |
| PR#1 | プロジェクト一覧への作業時間・金額表示 | ✅完了 (2026-05-31) |
| 13 | プロジェクト概要欄チェックボックス操作不能バグ修正 | ✅完了 (2026-05-31) |
| 14 | MarkdownEditorクリップボード貼り付け画像アップロード | ✅完了 (2026-05-31) |
| 15 | ノート編集モードにMarkdownEditorツールバーを追加 | ✅完了 (2026-05-31) |
| 16 | プロジェクトバナー期限表示＋モーダル説明欄削除 | ✅完了 (2026-06-01) |
| 17 | 添付ファイル孤立クリーンアップ（Phase 1削除時即時 + Phase 2手動ボタン） | ✅完了 (2026-06-01) |
| 18 | ノートプレビューエリアをダブルクリック編集に変更 | ✅完了 (2026-06-03) |
| 22 | Matrix連携 — pill メンション部分を inbox から除去 | ✅完了 (2026-06-04) |

## Matrix E2EE クロス署名（未対応の警告について）

Elementで表示される以下の警告は現時点で未対応：
- "Encrypted by a device not verified by its owner"
- "誰かが不明なセクションを使用しています"

### 対応予定
[matrix-bot-sdk PR #389](https://github.com/turt2live/matrix-bot-sdk/pull/389) がマージ・リリースされれば解消できる見込み。
- 内容: `confirmIdentityWithRecoveryKey(recoveryKey)` でBotデバイスをセルフ署名
- 依存の `@matrix-org/matrix-sdk-crypto-nodejs` v0.5.1 は 2026-04-23 リリース済み
- PR 自体は 2026-04-27 時点でレビュー待ち（未マージ）

### 次回 Matrix 関連修正時にやること
1. PR #389 がマージされているか確認する
2. マージ済みなら `matrix-bot-sdk` を最新版にアップグレードして `confirmIdentityWithRecoveryKey` を組み込む

## 参照先
- 新規タスク仕様: `docs/yoshiaki/tududi_tasks.md`
- 完了記録: `docs/yoshiaki/tududi_tasks_done.md`
