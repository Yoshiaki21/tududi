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
| 23 | Matrix E2EE 復号不具合修正 | ✅完了 (2026-06-10) |
| 24 | 本家 v1.14.0 取り込み | ✅完了 (2026-11-12, `merge-upstream-v1.14.0`) |
| 25 | バックアップのエクスポート/インポートに独自データを含める | ✅完了 (2026-11-12) |

## 本家との同期状況
- 取り込み済み: **v1.14.0** (`0da352fb`)。本家は 2026-11 時点で v2.1.0
- **本家 v2.0.0 で SQLite 廃止・PostgreSQL 専用** (e77dc529)。v2 へ進む前に別タスクで以下が必要:
  - データ移行: 本家の JSON バックアップは独自カラム（`work_hours`, `unit_price`, `default_unit_price`, `matrix_*`）を含まない → エクスポート/インポートの拡張か独自移行スクリプトが必要
  - Matrix crypto ストアの保存先が `DB_FILE` のディレクトリ依存（`backend/modules/matrix/matrixClient.js`）→ v2 では `DB_FILE` が無くなるので専用ボリューム/環境変数に変更
  - v2 は 1.x マイグレーションを `migrations/archive` に移し、新規 DB はモデルから作成 → 独自マイグレーションの扱いを再設計
- 添付ファイル（プロジェクト/ノート）は v1.14.0 取り込みで**本家実装に移行済み**。独自実装は削除
- 本家で作り直された画面（ノート、プロジェクト詳細/モーダル、通知設定）は「本家版＋独自機能を移植」の方針で維持する
- バックアップ（`backend/services/userDataTransfer.js`）は独自データ（`work_hours`, `unit_price`, `default_unit_price`, `matrix_*`, 添付 `title`）もエクスポート/インポートする（タスク25、変更箇所は `// yoshiaki21:` コメント）。**v2 へ移る際は v2 側の同ファイルにも同じ変更を入れてからインポートする**
- Matrix 暗号ストア（`db/matrix-store/<userId>`）はバックアップに含まれない。インスタンス移行時は手でコピーすること（ストア無しで同じアクセストークンを使うとデバイス鍵が食い違い E2EE が壊れる）

## Matrix E2EE クロス署名（未対応の警告について）

Elementで表示される以下の警告は現時点で未対応：
- "Encrypted by a device not verified by its owner"
- "誰かが不明なセクションを使用しています"

### 調査結果 (2026-11-11)
- `matrix-bot-sdk` 本家: 最新 0.8.0 (2026-01) のまま。[PR #389](https://github.com/turt2live/matrix-bot-sdk/pull/389) は**未マージ (open)**
- ⚠️ 現在の `@matrix-org/matrix-sdk-crypto-nodejs` 0.4.0 には **CVE-2026-45056**（High, to-device 送信者なりすまし）が残る。修正は 0.6.0 以降だが、本家 SDK は `^0.4.0` 固定のため入手不可
- Element 版フォーク **`@vector-im/matrix-bot-sdk`** (repo: element-hq/matrix-bot-sdk) が 0.9.0-element.0 (2026-05) でクロス署名対応。最新 0.10.1-element.0 (2026-09)、crypto-nodejs `^0.6.6`
  - `client.crypto.confirmIdentityWithRecoveryKey(key)` / `isRecoveryAvailable()` / `createIdentity(key?)`
  - 使用中の API（`MatrixClient`, `SimpleFsStorageProvider`, `RustSdkCryptoStorageProvider(dir, StoreType)`, `getWhoAmI`, `sendToDevices`, `start/stop/on`, 内部 `client.crypto.engine.machine`）はすべて互換
- Element 版へ移行する場合の影響:
  1. **Node >= 24 必須**（SDK・crypto-nodejs とも）→ Dockerfile を `node:24-trixie-slim`、CI も更新。本家は node 22 なので本家取り込み時の Dockerfile コンフリクトが増える。bcrypt / sqlite3 は N-API なので問題ない見込み（要ビルド確認）
  2. 0.10.0 で HTTP クライアントが `request`→`undici`（`setRequestFn` は未使用なので影響なし）
  3. crypto ストアは 0.4→0.6 で前方マイグレーションされ**ダウングレード不可** → 切替前に `tududi_db/matrix-store` をバックアップ
  4. crypto-nodejs 0.6.2 で自動ルームキー転送が無効化。独自の `requestMissingRoomKey` は要動作確認
  5. `require('matrix-bot-sdk')` 3 箇所（matrixClient.js, matrixPoller.js, controller.js）を `@vector-im/matrix-bot-sdk` に置換

### 次回 Matrix 関連修正時にやること
1. Element 版への移行可否を決める（Node 24 化とセットで CVE も解消できる）
2. 移行する場合: ユーザー設定に Matrix リカバリーキー欄（暗号化保存）を追加し、起動時に `isRecoveryAvailable()` → `confirmIdentityWithRecoveryKey()` でセルフ署名
3. 本家 SDK に留まる場合: PR #389 のマージ状況を再確認

## 参照先
- 新規タスク仕様: `docs/yoshiaki/tududi_tasks.md`
- 完了記録: `docs/yoshiaki/tududi_tasks_done.md`
