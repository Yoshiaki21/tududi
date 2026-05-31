# tududi 完了タスク記録

---

## タスク1: Markdownチェックボックス修正 ＋ ダブルクリック編集

- **完了日**: 2026-05以前
- **修正ファイル**: `frontend/components/Task/TaskDetails/TaskContentCard.tsx`
- **変更内容**:
  - `onClick={handleStartEdit}` → `onDoubleClick={handleStartEdit}` に変更
  - `title` 属性を "Double-click to edit content" / "Double-click to add content" に更新
- **備考**: `MarkdownRenderer.tsx` の `toggleCheckbox` ロジックは修正不要（実装済み）

---

## タスク2: Matrix 連携機能の実装

- **完了日**: 2026-05以前
- **新規ファイル**:
  - `backend/migrations/yoshiaki21-20260601000001-add-matrix-fields-to-users.js`
  - `backend/migrations/yoshiaki21-20260601000002-add-matrix-to-notification-preferences.js`
  - `backend/modules/matrix/index.js`
  - `backend/modules/matrix/routes.js`
  - `backend/modules/matrix/controller.js`
  - `backend/modules/matrix/matrixClient.js`
  - `backend/modules/matrix/matrixPoller.js`
  - `backend/modules/matrix/matrixNotificationService.js`
  - `backend/modules/matrix/matrixInitializer.js`
  - `frontend/components/Profile/tabs/MatrixTab.tsx`
  - `frontend/components/Shared/Icons/MatrixIcon.tsx`
- **修正ファイル**:
  - `backend/app.js` : Matrix ルート・初期化登録追加
  - `backend/modules/tasks/taskScheduler.js` : Matrix ユーザーを対象に追加
  - `backend/modules/tasks/taskSummaryService.js` : Matrix 送信処理追加
  - `backend/modules/tasks/dueTaskService.js` / `deferredTaskService.js`
  - `backend/modules/projects/dueProjectService.js`
  - `backend/utils/notificationPreferences.js` : `shouldSendMatrixNotification` 追加
  - `backend/models/User.js` : Matrix フィールド追加
  - Profile 画面: Matrix タブ追加
- **使用ライブラリ**: `matrix-bot-sdk`
- **備考**: E2EE は初期実装では非対応（タスク7で対応）

---

## タスク3: Markdownチェックボックス更新時の Toast 抑制

- **完了日**: 2026-05以前
- **修正ファイル**:
  - `frontend/components/Task/TaskDetails/TaskContentCard.tsx`
  - `frontend/components/Task/TaskDetails.tsx`
  - `frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx`
- **変更内容**:
  - `onUpdate` の型に `options?: { silent?: boolean }` を追加
  - チェックボックス経由の更新に `{ silent: true }` を付与
  - `handleContentUpdate` で `silent` フラグを判定して Toast を抑制
  - テストを新シグネチャに合わせて更新

---

## タスク4: マイグレーション衝突回避のためのプレフィックス導入

- **完了日**: 2026-05以前
- **変更内容**:
  - Matrix マイグレーション2ファイルを `yoshiaki21-` プレフィックス付きにリネーム
  - `SequelizeMeta` テーブルの該当行を新ファイル名に UPDATE
- **運用ルール**: 新規マイグレーションは `yoshiaki21-YYYYMMDDxxxxxx-description.js` 形式

---

## タスク5: Dockerfile の Alpine → Debian slim 移行

- **完了日**: 2026-05以前
- **修正ファイル**: `Dockerfile`, `scripts/docker-entrypoint.sh`
- **変更内容**:
  - `node:22-alpine` → `node:22-slim`（後にタスク6で `trixie-slim` に変更）
  - `apk` → `apt-get`
  - `su-exec` → `gosu`
  - `addgroup/adduser` → `groupadd/useradd`
- **理由**: `matrix-bot-sdk` が glibc を要求するため Alpine (musl) では動作不可

---

## タスク6: Dockerfile ベースイメージを node:22-trixie-slim に修正

- **完了日**: 2026-05以前
- **修正ファイル**: `Dockerfile`
- **変更内容**: `node:22-slim` → `node:22-trixie-slim`（Debian 13 / glibc 2.40）
- **理由**: `sqlite3` プリビルドバイナリが glibc 2.38 以上を要求

---

## タスク7: Matrix E2EE（エンドツーエンド暗号化）対応

- **完了日**: 2026-05-30
- **修正ファイル**:
  - `backend/modules/matrix/matrixClient.js`
  - `backend/modules/matrix/matrixPoller.js`
  - `docker-compose.yml`
- **変更内容**:
  - `RustSdkCryptoStorageProvider` を追加し `MatrixClient` の第4引数に渡す
  - crypto ディレクトリ (`./data/matrix-store/<userId>/crypto/`) を自動作成
  - `room.invite` イベントハンドラで暗号化ルームへの招待を自動承諾
  - `docker-compose.yml` に `./data:/app/backend/data` ボリュームを追加

---

## タスク8: matrixPoller.js の Stop/Start 動作修正

- **完了日**: 2026-05以前
- **修正ファイル**: `backend/modules/matrix/matrixPoller.js`
- **変更内容**:
  - `uploadDeviceKeys()` の呼び出しを削除（E2EE は `client.start()` 時に自動初期化）
  - `stop()` に 1000ms の待機処理を追加（crypto ストレージのロック解放待ち）
  - `start()` でキャッシュではなく DB から最新設定を取得
  - `room.message` ハンドラ内で毎回 DB から最新 Room ID を取得（クロージャ問題の解消）

---

## タスク9: MatrixTab UI改善（保存ボタン統一 ＋ タスクサマリー通知設定追加）

- **完了日**: 2026-05以前
- **修正ファイル**:
  - `frontend/components/Profile/tabs/MatrixTab.tsx`
  - `backend/modules/matrix/routes.js`
  - `backend/modules/matrix/controller.js`
- **変更内容**:
  - 「Save Matrix Settings」ボタンを削除し「変更を保存」に統一
  - タスクサマリー通知セクション（トグル・頻度選択・テスト送信ボタン）を追加
  - `/api/matrix/test-summary` エンドポイントを追加

---

## タスク11: 人工単価入力欄のスピナー（上下矢印）を非表示

- **完了日**: 2026-05-31
- **動作確認**: ✅ 済み
- **修正ファイル**:
  - `frontend/styles/tailwind.css` : `.no-spinner` クラス追加
  - `frontend/components/Project/WorkSummaryCard.tsx` : input に `no-spinner` クラス付与
- **変更内容**:
  - CSS で `::-webkit-inner-spin-button` / `::-webkit-outer-spin-button` を非表示
  - Firefox 用に `-moz-appearance: textfield` を適用
- **確認項目**:
  - 単価入力欄にマウスオーバーしても上下矢印が表示されない
  - 手入力で数値を入力・保存できる

---

## タスク12: プロジェクト概要欄をタブ切り替え式に変更

- **完了日**: 2026-05-31
- **動作確認**: ✅ 済み
- **修正ファイル**:
  - `frontend/components/Project/ProjectDetails.tsx`
- **変更内容**:
  - `activeTab` の型を `'tasks' | 'notes'` → `'description' | 'tasks' | 'notes'` に変更
  - タブに「概要」ボタンを先頭に追加（概要→タスク→ノートの順）
  - 概要の常時表示をタスクセクションから削除
  - `activeTab === 'description'` のときのみ概要編集エリアを表示
  - 編集UX（ダブルクリックで編集、Markdown対応）はそのまま維持
- **確認項目**:
  - タブが「概要・タスク・ノート」の順で表示される
  - 「概要」タブで概要テキストエリアが表示される
  - 「タスク」タブでタスクリストが表示される
  - 概要欄でMarkdownが正常にレンダリングされる
  - 概要テキストを編集・保存後、リロードしても内容が残る

---

## タスク10: 工数管理機能の追加（作業時間記録・プロジェクト集計・人工計算）

- **完了日**: 2026-05-31
- **新規ファイル**:
  - `backend/migrations/yoshiaki21-20260531000001-add-work-hours-to-tasks.js`
  - `backend/migrations/yoshiaki21-20260531000002-add-unit-price-to-projects.js`
  - `backend/migrations/yoshiaki21-20260531000003-add-default-unit-price-to-users.js`
  - `frontend/components/Task/TaskDetails/TaskWorkHoursCard.tsx`（新規）
  - `frontend/components/Project/WorkSummaryCard.tsx`（新規）
- **修正ファイル**:
  - `backend/models/task.js` : `work_hours` フィールド追加
  - `backend/models/project.js` : `unit_price` フィールド追加
  - `backend/models/user.js` : `default_unit_price` フィールド追加
  - `backend/modules/tasks/core/builders.js` : `work_hours` を追加
  - `backend/modules/projects/service.js` : `unit_price` 受付・`total_work_hours` 集計追加
  - `backend/modules/users/service.js` : `default_unit_price` 追加
  - `backend/modules/users/repository.js` : PROFILE_ATTRIBUTES に各フィールド追加
  - `frontend/entities/Task.ts` : `work_hours` 追加
  - `frontend/entities/Project.ts` : `unit_price`, `total_work_hours` 追加
  - `frontend/components/Profile/types.ts` : `default_unit_price` 追加
  - `frontend/components/Task/TaskDetails/index.ts` : `TaskWorkHoursCard` エクスポート追加
  - `frontend/components/Task/TaskDetails.tsx` : `TaskWorkHoursCard` を `TaskDueDateCard` の上に追加
  - `frontend/components/Project/ProjectDetails.tsx` : `WorkSummaryCard` 追加、概要欄追加
  - `frontend/components/Profile/tabs/GeneralTab.tsx` : デフォルト人工単価入力欄追加
  - `frontend/components/Profile/ProfileSettings.tsx` : コールバック追加
  - `frontend/components/Project/ProjectModal.tsx` : `unit_price` 入力欄追加
- **実装ルール**:
  - 単価優先順位: `project.unit_price ?? user.default_unit_price ?? 25000`
  - 8時間 = 1人工
  - `work_hours` が null のタスクは集計除外
  - `safeAddColumns` のテーブル名は小文字で渡す
