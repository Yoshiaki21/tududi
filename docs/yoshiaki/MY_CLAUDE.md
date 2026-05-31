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

## 参照先
- 新規タスク仕様: `docs/yoshiaki/tududi_tasks.md`
- 完了記録: `docs/yoshiaki/tududi_tasks_done.md`
