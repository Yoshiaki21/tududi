# tududi 改修作業指示書

## タスク1: Markdownチェックボックス修正 ＋ ダブルクリック編集

### 対象ファイル

```
frontend/components/Task/TaskDetails/TaskContentCard.tsx
```

### 背景

タスクの概要欄（content）は Markdown で記述でき、`- [ ]` 記法でチェックボックスを表示できる。
しかし現状、表示モードの `<div>` に `onClick={handleStartEdit}` が設定されているため、
チェックボックスをクリックすると編集モードに遷移してしまい、チェックの操作ができない。

あわせて、編集モードへの遷移をシングルクリックからダブルクリックに変更する。

### 修正内容

表示モードのコンテナ `<div>` を以下の2点で修正する：

1. `onClick={handleStartEdit}` → `onDoubleClick={handleStartEdit}` に変更
2. `title` 属性のテキストを "Double-click to edit content" に変更

#### 修正箇所（content がある場合の表示ブロック）

```tsx
// 修正前
<div
    onClick={handleStartEdit}
    className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
    title={t(
        'task.clickToEditContent',
        'Click to edit content'
    )}
>

// 修正後
<div
    onDoubleClick={handleStartEdit}   // シングルクリック → ダブルクリックに変更
    className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
    title={t(
        'task.doubleClickToEditContent',
        'Double-click to edit content'   // ツールチップも更新
    )}
>
```

#### content が空の場合の表示ブロックも同様に修正

```tsx
// 修正前
<div
    onClick={handleStartEdit}
    ...
    title={t('task.clickToAddContent', 'Click to add content')}
>

// 修正後
<div
    onDoubleClick={handleStartEdit}
    ...
    title={t('task.doubleClickToAddContent', 'Double-click to add content')}
>
```

### 期待される動作

- チェックボックスをシングルクリック → チェック状態がトグルされ即時保存される
- 本文エリアをダブルクリック → 編集モードに入る
- シングルクリックでは何も起きない

### 注意事項

- `MarkdownRenderer.tsx` は修正不要（チェックボックスの `toggleCheckbox` ロジックは実装済み）
- `onContentChange={onUpdate}` は既に渡されているため追加不要

---

## タスク2: Matrix 連携機能の実装

### 概要

Telegram 連携と同等の機能を Matrix プロトコルで実現する。
アーキテクチャは既存の `backend/modules/telegram/` を参考にして対称的に実装する。

### 使用ライブラリ

```bash
npm install matrix-bot-sdk
```

`matrix-bot-sdk` を選定する理由：Node.js バックエンド専用設計で、ポリフィル不要、
Telegram の polling パターンに近い API 構造を持つ。

---

### バックエンド実装

#### 1. DBマイグレーション（2ファイル）

**ファイル名**: `backend/migrations/20260601000001-add-matrix-fields-to-users.js`

`Users` テーブルに以下のカラムを追加する：

| カラム名 | 型 | 説明 |
|---|---|---|
| `matrix_homeserver_url` | STRING | homeserver の URL（例: https://matrix.example.com）|
| `matrix_access_token` | STRING | bot アカウントのアクセストークン |
| `matrix_room_id` | STRING | 受信・送信に使うルームID（例: !xxx:homeserver）|
| `matrix_bot_user_id` | STRING | bot の Matrix ユーザーID（例: @tududi-bot:homeserver）|
| `matrix_allowed_users` | ARRAY(STRING) | メッセージを受け付ける Matrix ユーザーIDのリスト |

参考: `backend/migrations/20250813103351-add-telegram-allowed-users.js`

---

**ファイル名**: `backend/migrations/20260601000002-add-matrix-to-notification-preferences.js`

`notification_preferences` JSON カラムの各キー（`dueTasks`, `overdueTasks`, `deferUntil`, `dueProjects`, `overdueProjects`）に `matrix: false` フィールドを追加する。

参考: `backend/migrations/20251209000001-add-telegram-to-notification-preferences.js`

---

#### 2. モジュール構成

`backend/modules/matrix/` ディレクトリを新規作成し、以下の7ファイルを実装する。

---

**`backend/modules/matrix/index.js`**

Telegram の `backend/modules/telegram/index.js` と同じ構造でルート・コントローラ・初期化処理をエクスポートする。

---

**`backend/modules/matrix/routes.js`**

Telegram の `backend/modules/telegram/routes.js` を参考に、
Matrix 設定の保存・取得・接続テスト用のエンドポイントを定義する。

---

**`backend/modules/matrix/controller.js`**

Telegram の `backend/modules/telegram/controller.js` を参考に実装する。
設定保存時は `matrix_homeserver_url`, `matrix_access_token`, `matrix_room_id`, `matrix_bot_user_id`, `matrix_allowed_users` をユーザーレコードに保存する。

---

**`backend/modules/matrix/matrixClient.js`**

`matrix-bot-sdk` の薄いラッパー。クライアントインスタンスの生成と管理を担当する。

```javascript
const { MatrixClient, SimpleFsStorageProvider } = require("matrix-bot-sdk");

// homeserverUrl, accessToken を受け取りクライアントを生成して返す
// ストレージは ./data/matrix-store/<userId>/ に保存する
```

---

**`backend/modules/matrix/matrixPoller.js`**

Telegram の `backend/modules/telegram/telegramPoller.js` を参考に実装する。

主要な機能：

- `start(userId)` : 対象ユーザーのクライアントを起動し `room.message` イベントを監視する
- `stop(userId)` : クライアントを停止する
- `processMessage(user, event)` : メッセージを受信して InboxItem を作成する
- `sendMatrixMessage(homeserverUrl, accessToken, roomId, message)` : メッセージを送信する
- `handleBotCommand(command, user, roomId)` : `/start`, `/help` コマンドを処理する

メッセージ受信の実装パターン：

```javascript
client.on("room.message", async (roomId, event) => {
    // 自分自身のメッセージは無視
    if (event.sender === botUserId) return;
    // m.room.message タイプ以外は無視
    if (event.type !== "m.room.message") return;
    // allowed_users チェック
    // テキスト抽出して processMessage へ
    const text = event.content.body;
    await processMessage(user, { roomId, text, sender: event.sender });
});
```

重複処理防止のため、処理済みイベントID（`event_id`）を DB または メモリで管理する。
（Telegram の `messageId` に相当）

---

**`backend/modules/matrix/matrixNotificationService.js`**

Telegram の `backend/modules/telegram/telegramNotificationService.js` を参考に実装する。

通知送信時は `sendMatrixMessage` を呼び出す。
Markdown 記法はそのまま使用できる（Matrix は Markdown をサポート）。

---

**`backend/modules/matrix/matrixInitializer.js`**

Telegram の `backend/modules/telegram/telegramInitializer.js` を参考に実装する。
アプリ起動時に全ユーザーの Matrix 設定を読み込んで polling を開始する。

---

#### 3. 既存ファイルの修正

**`backend/app.js`**

Telegram のルート・初期化登録を参考に、Matrix モジュールを同様に登録する。

```javascript
// 追加箇所のパターン（Telegram と同じ構造）
const matrixRoutes = require('./modules/matrix');
app.use('/api/matrix', matrixRoutes);

// 初期化
const matrixInitializer = require('./modules/matrix/matrixInitializer');
await matrixInitializer.initialize();
```

---

**`backend/modules/tasks/taskScheduler.js`**

`fetchUsersForFrequency` 関数を修正して、Matrix 設定を持つユーザーも対象に含める。

```javascript
// 修正前: telegram_bot_token が null でないユーザーのみ対象
// 修正後: telegram_bot_token または matrix_access_token が null でないユーザーを対象
const { Op } = require('sequelize');
where: {
    [Op.or]: [
        { telegram_bot_token: { [Op.ne]: null } },
        { matrix_access_token: { [Op.ne]: null } },
    ],
    task_summary_enabled: true,
    task_summary_frequency: frequency,
}
```

---

**`backend/modules/tasks/taskSummaryService.js`**

`sendSummaryToUser` 関数を修正して、Matrix にも送信できるようにする。

```javascript
// Telegram 送信の既存処理はそのまま残す
// Matrix 設定があれば matrixNotificationService.sendMatrixMessage も呼ぶ
if (user.matrix_access_token && user.matrix_room_id) {
    await matrixNotificationService.sendMessage(
        user.matrix_homeserver_url,
        user.matrix_access_token,
        user.matrix_room_id,
        summary
    );
}
```

---

**`backend/modules/tasks/dueTaskService.js`**
**`backend/modules/tasks/deferredTaskService.js`**
**`backend/modules/projects/dueProjectService.js`**

各ファイルの `sources` 配列への追加箇所を修正する。

```javascript
// 既存の Telegram チェック
if (shouldSendTelegramNotification(task.User, notificationType)) {
    sources.push('telegram');
}

// Matrix チェックを追加
if (shouldSendMatrixNotification(task.User, notificationType)) {
    sources.push('matrix');
}
```

`shouldSendMatrixNotification` 関数を `backend/utils/notificationPreferences.js` に追加する。
実装は `shouldSendTelegramNotification` と同じパターンで `matrix` キーを参照する。

---

**`backend/models/User.js`**

Matrix 関連フィールドを Model 定義に追加する：

```javascript
matrix_homeserver_url: { type: DataTypes.STRING },
matrix_access_token: { type: DataTypes.STRING },
matrix_room_id: { type: DataTypes.STRING },
matrix_bot_user_id: { type: DataTypes.STRING },
matrix_allowed_users: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
```

---

### フロントエンド実装

#### 1. MatrixTab コンポーネント

**ファイル名**: `frontend/components/Profile/tabs/MatrixTab.tsx`

`frontend/components/Profile/tabs/TelegramTab.tsx` を参考に実装する。

設定項目：

| 項目 | 説明 |
|---|---|
| Homeserver URL | Matrix homeserver の URL |
| Access Token | bot アカウントのアクセストークン |
| Bot User ID | bot の Matrix ユーザーID |
| Room ID | 受信・送信に使うルームID |
| Allowed Users | 許可する Matrix ユーザーIDのリスト |

UI に以下のガイダンスを含める：
- アクセストークンの取得方法（`/_matrix/client/v3/login` API への curl コマンド例）
- ルームIDの確認方法（Element での確認方法）

---

#### 2. Profile 画面へのタブ追加

**ファイル名**: `frontend/components/Profile/` 配下の Profile ページコンポーネント

Telegram タブが追加されている箇所と同じパターンで Matrix タブを追加する。

---

#### 3. アイコンコンポーネント

**ファイル名**: `frontend/components/Shared/Icons/MatrixIcon.tsx`

`TelegramIcon.tsx` を参考に Matrix のロゴ SVG を使ったアイコンコンポーネントを作成する。
Matrix のロゴ（[m] マーク）は以下の SVG パスで実装する：

```
公式ロゴのパス: https://matrix.org/images/matrix-logo.svg 参照
または、シンプルに "[m]" テキストベースのアイコンでも可
```

---

### 実装上の注意事項

#### matrix-bot-sdk のストレージ

`SimpleFsStorageProvider` を使う場合、ストレージパスの権限に注意する。
`./data/matrix-store/` ディレクトリが存在しない場合は自動作成する処理を入れる。

```javascript
const fs = require('fs');
const storageDir = `./data/matrix-store/${userId}`;
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
}
```

#### 複数ユーザーのクライアント管理

Telegram と同様に、ユーザーIDをキーとした Map でクライアントインスタンスを管理する。

```javascript
const activeClients = new Map(); // userId -> MatrixClient
```

#### E2EE は対応しない

初期実装では E2EE（暗号化ルーム）は対応しない。
通常ルーム（非暗号化）のみをサポートする。

#### イベントの重複処理防止

`matrix-bot-sdk` は初回 sync 時に過去のメッセージも流してくることがある。
`client.start()` の前に `syncToken` を適切に設定するか、
処理済みイベントID を Set で管理して重複を防ぐ。

```javascript
const processedEvents = new Set();

client.on("room.message", async (roomId, event) => {
    if (processedEvents.has(event.event_id)) return;
    processedEvents.add(event.event_id);
    // ... 処理
});
```

---

### 動作確認手順

1. Matrix homeserver で bot 用アカウントを作成
2. curl でアクセストークンを取得：
   ```bash
   curl -XPOST 'https://YOUR_HOMESERVER/_matrix/client/v3/login' \
     -H 'Content-Type: application/json' \
     -d '{"type":"m.login.password","user":"tududi-bot","password":"PASSWORD"}'
   ```
3. Element 等で tududi 専用ルームを作成し bot を招待
4. ルームIDを確認（ルーム設定 → 詳細情報）
5. tududi Profile の Matrix タブで設定を保存
6. ルームからテキストメッセージを送信して Inbox に登録されることを確認
7. タスクに期限を設定して通知が届くことを確認
