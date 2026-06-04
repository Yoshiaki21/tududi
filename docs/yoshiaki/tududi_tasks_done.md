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

---

## タスク13: プロジェクト概要欄チェックボックス操作不能バグ修正

- **完了日**: 2026-05-31
- **修正ファイル**:
  - `frontend/components/Project/ProjectDetails.tsx`
  - `frontend/components/Shared/MarkdownRenderer.tsx`
- **原因**: `MarkdownRenderer` は `onContentChange` が渡されない場合にチェックボックスを `disabled` にする設計だが、概要欄の `MarkdownRenderer` に `onContentChange` を渡していなかった
- **変更内容**:
  - `ProjectDetails.tsx`: `handleDescriptionCheckboxChange` 関数を追加し、`MarkdownRenderer` の `onContentChange` に渡すよう修正。チェックボックス変更時に即座に `updateProject` でサーバーへ保存
  - `MarkdownRenderer.tsx`: チェックボックス `input` に `onDoubleClick` の `stopPropagation` を追加（親 `div` の `onDoubleClick` 編集モード誤発火を防止）

---

## タスク14: MarkdownEditor クリップボード貼り付けによる画像アップロード対応

- **完了日**: 2026-05-31
- **修正ファイル**:
  - `frontend/components/Shared/MarkdownEditor.tsx`
- **変更内容**:
  - `handlePaste` 関数を追加：`e.clipboardData.items` から画像を検出し、既存の `uploadImageForContext` でアップロード後に Markdown を挿入
  - `generatePasteFilename`: MIMEタイプから `paste-YYYYMMDD-HHmmss.png` 形式のファイル名を生成
  - `isGenericFilename`: `image.png` / `image.jpg` 等の汎用名を正規表現で判定
  - `<textarea>` に `onPaste={handlePaste}` を追加
  - placeholder テキストを「ドラッグ＆ドロップまたは貼り付け可」に更新
- **ファイル名ルール**:
  - スクリーンショット等で `file.name` が `image.png` 等の汎用名 → `paste-YYYYMMDD-HHmmss.png` に自動置換
  - ファイルエクスプローラーからコピーした場合 → 元のファイル名を保持
  - テキストのみのクリップボード → `e.preventDefault()` を呼ばず通常貼り付けとして動作

---

## タスク16: プロジェクトバナー表示の改善とモーダルから説明欄を削除

- **完了日**: 2026-06-01
- **修正ファイル**:
  - `frontend/components/Project/ProjectBanner.tsx`
  - `frontend/components/Project/ProjectModal.tsx`
- **変更内容**:
  - `ProjectBanner.tsx`:
    - バナー画像オーバーレイに表示していた `project.description` を削除
    - 代わりに `project.due_date_at` が設定されている場合に「プロジェクト期限YYYY年M月D日」形式で表示（タイムゾーンずれ回避のため ISO 文字列を直接パース）
  - `ProjectModal.tsx`:
    - 説明テキストエリア（③）を削除（概要タブで入力するため不要）
    - `hasUnsavedChanges` 内の `description` 比較チェックを削除
    - 説明欄削除分のウィンドウ高さを調整（`sm:min-h-[500px]` → `sm:min-h-[320px]`）
- **背景**:
  - バナーに概要テキストが重複表示されていた（バナー内④と概要タブ②の2箇所）
  - 説明は概要タブで管理するため、モーダルの入力欄は不要
  - バナーには期限を表示する方が有用

---

## 添付ファイル孤立クリーンアップ（Phase 1 + Phase 2）

- **完了日**: 2026-06-01
- **動作確認**: ✅ 済み

### Phase 1: 削除時の即時クリーンアップ

- **修正ファイル**:
  - `backend/modules/tasks/routes.js`
  - `backend/modules/projects/repository.js`
  - `backend/modules/notes/service.js`
- **変更内容**:
  - `tasks/routes.js`: `deleteAttachmentsForTask()` helper 追加。繰り返しタスクの未来インスタンスと親タスク削除前に呼び出し、`task_attachments` のDBレコードとディスクファイルを削除
  - `projects/repository.js`: `ProjectAttachment` を import し、`project.destroy()` 前にプロジェクト添付ファイルをループ削除（既存トランザクション内）
  - `notes/service.js`: `NoteAttachment` / `deleteFileFromDisk` を import し、`note.destroy()` 前にノート添付ファイルをループ削除
- **背景**:
  - SQLite の `foreign_keys` pragma がデフォルト OFF のため `onDelete: 'CASCADE'` が機能しない
  - タスク削除時は `PRAGMA foreign_keys = OFF` 中に削除するためさらにCASCADEが無効
  - 従来はタスク・ノート削除時、およびプロジェクト削除時のプロジェクト自体の添付ファイルが孤立していた

### Phase 2: 設定ページに孤立ファイル削除ボタン

- **新規ファイル**:
  - `backend/modules/cleanup/service.js`: `Op.notIn + literal` サブクエリで3テーブル（task_attachments / project_attachments / note_attachments）の孤立レコードを検出・削除。削除件数と解放バイト数を返す
  - `backend/modules/cleanup/routes.js`: `POST /api/cleanup/orphaned-attachments`
  - `backend/modules/cleanup/index.js`
  - `frontend/components/Profile/tabs/StorageTab.tsx`: 「クリーンアップを実行」ボタン、削除件数・解放容量を表示
- **修正ファイル**:
  - `backend/app.js`: cleanupModule を登録
  - `frontend/components/Profile/ProfileSettings.tsx`: ストレージタブ追加（一覧末尾）
- **アクセス方法**: 設定ページ（`/profile?section=storage`）→ ストレージタブ → クリーンアップを実行

---

## タスク17: プロジェクト設定モーダルの期限セクションをデフォルト展開 ＋ スピナー非表示

- **完了日**: 2026-06-01
- **動作確認**: ✅ 済み
- **修正ファイル**:
  - `frontend/components/Project/ProjectModal.tsx`
  - `frontend/components/Profile/tabs/GeneralTab.tsx`
- **変更内容**:
  - `ProjectModal.tsx`: `expandedSections.dueDate` の初期値を `false` → `true` に変更（モーダルを開いた時点で期限・人工単価セクションが展開された状態になる）
  - `ProjectModal.tsx`: 人工単価 `<input type="number">` の `className` に `[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none` を追加（▽△スピナーを非表示）
  - `GeneralTab.tsx`: デフォルト人工単価 `<input type="number">` の `className` に同様のスピナー非表示クラスを追加
- **確認項目**:
  - プロジェクト設定を開くと期限・人工単価欄が最初から表示される
  - 人工単価入力欄にスピナー（▽△）が表示されない
  - プロフィール設定のデフォルト人工単価入力欄にもスピナーが表示されない

---

## タスク15: ノート編集モードにMarkdownEditorツールバーを追加

- **完了日**: 2026-05-31
- **修正ファイル**:
  - `frontend/components/Notes.tsx`
- **原因**: ノート一覧でノートタイトルをクリックして編集モードに入ると、コンテンツ入力欄が plain `<textarea>` のままで `MarkdownEditor` コンポーネントが使われていなかったため、ツールバー（B/I/H/≡/☑/`<>`/—/🔗）が表示されていなかった
- **変更内容**:
  - `MarkdownEditor` を import 追加
  - 編集モード内の `<textarea>` を `<MarkdownEditor>` に置き換え
    - `uploadContext={{ type: 'note', uid: editingNote.uid || null }}` を設定（画像D&Dおよびクリップボード貼り付けも有効化）
    - `onKeyDown` で `Cmd/Ctrl+Enter` → 保存、`Esc` → キャンセルのショートカットを追加
  - エディタ下部に「保存」「キャンセル」ボタンとショートカットヒントテキストを追加
- **確認項目**:
  - ノートをクリックして編集モードに入るとツールバーが表示される
  - B/I/H/≡/☑/`<>`/—/🔗 の各ボタンが動作する
  - 画像のドラッグ&ドロップおよびクリップボード貼り付けが動作する
  - 「保存」ボタンで保存、「キャンセル」で破棄できる

---

## タスク18: ノートプレビューエリアをダブルクリック編集に変更

- **完了日**: 2026-06-03
- **修正ファイル**:
  - `frontend/components/Notes.tsx`
  - `frontend/components/Note/NoteDetails.tsx`
- **変更内容**:
  - `Notes.tsx`: タイトル（`h1`）とコンテンツエリア（`div`）の `onClick` → `onDoubleClick` に変更、`title` を "Click to edit" → "ダブルクリックして編集" に更新
  - `NoteDetails.tsx`: コンテンツエリアのラッパー `div` に `onDoubleClick={handleEditNote}` を追加、ホバー時のボーダーエフェクトとツールチップ "ダブルクリックして編集" を追加
- **備考**: プロジェクト概要（`ProjectDetails.tsx`）のダブルクリック編集と同じ操作感に統一。チェックボックスへの影響なし（`stopPropagation` で保護済み）。鉛筆ボタンは単一クリックのまま残存

---

## タスク20: Matrix連携 — pill メンション対応 ＋ 全ルーム対象化

- **完了日**: 2026-06-04
- **動作確認**: ✅ 済み
- **修正ファイル**:
  - `backend/modules/matrix/matrixPoller.js`
- **変更内容**:
  - `isAuthorizedMatrixUser` 関数を削除し `isBotMentioned` 関数に置き換え
    - `event.content['m.mentions'].user_ids`（Matrix spec 1.7+）→ `formatted_body` の pill リンク → `body` テキストのフォールバック順で検出
  - `room.message` ハンドラーからルームIDフィルター（`matrix_room_id` による絞り込み）を削除し、botが参加しているすべてのルームを対象化
  - `room.message` ハンドラーに `isBotMentioned` チェックを追加（pill メンションがある発言のみ inbox に追加）
  - `processMessage` 内の `isAuthorizedMatrixUser` 呼び出しを削除
  - `room.invite` ハンドラー（招待の自動承諾）を削除 — roomへの参加は手動管理に変更
- **設計方針**:
  - セキュリティ境界を「許可ユーザーリスト」ではなく「botを参加させるroomかどうか」で制御
  - `matrix_bot_user_id` が未設定の場合は `isBotMentioned` が常に false を返すため、メッセージは処理されない（設定必須）

---

## タスク21: Matrix設定 — アクセストークン上書きバグ修正 ＋ UI仕様変更

- **完了日**: 2026-06-04
- **動作確認**: ✅ 済み
- **修正ファイル**:
  - `backend/modules/matrix/controller.js`
  - `frontend/components/Profile/tabs/MatrixTab.tsx`
  - `frontend/components/Profile/types.ts`

### バグ修正: アクセストークンが `'***'` で上書きされる問題

- **原因**:
  1. `getSettings` がトークンをマスクして `'***'` を返す
  2. `MatrixTab` がそれをそのまま state にセット
  3. 保存時に `'***'` をそのままPOSTしてしまい、DBのトークンが `'***'` で上書きされていた
- **修正内容**:
  - `controller.js` `saveSettings`: `matrix_access_token` が空・`'***'` の場合はDBを更新しないよう変更（`updates` オブジェクトを条件付きで構築）
  - `MatrixTab.tsx`: ロード時に `matrix_access_token` は常に空文字でstateに格納。`tokenIsSet` フラグ（boolean）で「既に設定済み」を管理。保存時はトークン入力欄に新しい値がある場合のみ送信

### 仕様変更: `matrix_room_id` を通知専用ルームとして維持、`matrix_allowed_users` を廃止

- **変更内容**:
  - `controller.js` `saveSettings`: `matrix_allowed_users` の保存処理を削除
  - `controller.js` `getSettings`: `matrix_allowed_users` をAPIレスポンスから削除。`configured` の条件を `homeserver + token + bot_user_id`（`matrix_room_id` 不要）に変更
  - `MatrixTab.tsx`:
    - `allowedUsersInput` state と「Allowed Users」フィールドを削除
    - 「Room ID」→「Notification Room ID」にラベル変更。説明文をタスクサマリー・通知の送信先専用であることを明示
    - Bot User ID の説明文を「pill メンション検出に必須」と更新
    - 「Send Test Summary」ボタンを `matrix_room_id` 未設定でも無効化（Notification Room ID が必要であるメッセージを追加）
    - 接続確認済みバナー（configured）の表示条件を新しい `configured` 定義（room_id不要）に合わせて更新
    - アクセストークンのプレースホルダー表示を `settings.configured` から `tokenIsSet` フラグに変更
  - `types.ts`: `Profile` インターフェースから `matrix_allowed_users` フィールドを削除
- **保持した動作**: タスクサマリー・通知の送信先（`matrix_room_id`）は引き続きDB・UIに残存。`matrixNotificationService.js`・`taskSummaryService.js`・`taskScheduler.js` は変更なし

---

## タスク19: Markdownコードブロックのコピーボタン機能修正

- **完了日**: 2026-06-04
- **動作確認**: ✅ 済み
- **修正ファイル**:
  - `frontend/components/Shared/MarkdownRenderer.tsx`
  - `frontend/styles/markdown.css`
- **原因**: "Copy" ボタンが CSS 疑似要素（`::after`）で見た目だけ実装されており、クリックイベントを受け取れないため機能していなかった
- **変更内容**:
  - `MarkdownRenderer.tsx`: `pre` コンポーネントを `div.relative.group` でラップし、本物の `<button>` 要素を追加。クリック時に `navigator.clipboard.writeText()` でコードをコピー。2秒間「✓ Copied」表示後に「Copy」に戻る
  - `markdown.css`: 機能しない `pre:hover::after` 疑似要素を削除。`pre` の `position: relative` と `margin` も削除（ラッパー `div` と Tailwind `mb-4` に移譲）
- **確認項目**:
  - コードブロックにホバーすると "Copy" ボタンが表示される
  - クリックするとコードがクリップボードにコピーされる
  - コピー後 2 秒間「✓ Copied」と表示される
