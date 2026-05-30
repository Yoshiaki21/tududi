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

---

## タスク3: Markdownチェックボックス更新時の Toast 抑制

### 背景

タスク1 でチェックボックスをクリック可能にしたが、チェックを切り替えるたびに
「Task content updated successfully」の Toast が表示され、UX 上ノイズになっていた。
編集モードの Save 時のみ Toast を出し、チェックボックス操作時は静かに保存したい。

### 修正方針（案A: silent フラグ）

呼び出し側が「これは静かな更新だ」と明示するパターン。
インタフェースは増えるが責務が明確で、最小限のファイル変更で済む。

### 対象ファイル

```
frontend/components/Task/TaskDetails/TaskContentCard.tsx
frontend/components/Task/TaskDetails.tsx
frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx
```

### 修正内容

#### 1. `TaskContentCard.tsx` の Props 型を拡張

```tsx
// 修正前
interface TaskContentCardProps {
    content: string;
    onUpdate: (newContent: string) => Promise<void>;
}

// 修正後
interface TaskContentCardProps {
    content: string;
    onUpdate: (
        newContent: string,
        options?: { silent?: boolean }
    ) => Promise<void>;
}
```

#### 2. `MarkdownRenderer` への `onContentChange` をラップ

チェックボックス経由の更新には `{ silent: true }` を付与する。

```tsx
// 修正前
<MarkdownRenderer
    content={content}
    className="prose dark:prose-invert max-w-none"
    onContentChange={onUpdate}
/>

// 修正後
<MarkdownRenderer
    content={content}
    className="prose dark:prose-invert max-w-none"
    onContentChange={(newContent) =>
        onUpdate(newContent, { silent: true })
    }
/>
```

#### 3. `TaskDetails.tsx` の `handleContentUpdate` で silent を判定

```tsx
const handleContentUpdate = async (
    newContent: string,
    options?: { silent?: boolean }
) => {
    // ... 既存の処理 ...

    if (!options?.silent) {
        showSuccessToast(
            t('task.contentUpdated', 'Task content updated successfully')
        );
    }

    // ... 既存の処理 ...
};
```

エラー時の `showErrorToast` は silent 関係なく従来通り表示する。

#### 4. テスト更新

`TaskContentCard.test.tsx` のチェックボックスクリックテストを新シグネチャに合わせる：

```tsx
expect(onUpdate).toHaveBeenCalledWith('- [x] Do something', {
    silent: true,
});
```

### 期待される動作

- チェックボックスをクリック → 保存はされるが Toast は出ない
- 編集モードで Save ボタンを押す → これまで通り Toast が出る
- エラー発生時は Toast で通知される

---

## タスク4: マイグレーション衝突回避のためのプレフィックス導入

### 背景

自フォーク（`Yoshiaki21/tududi`）で追加したマイグレーションが上流（`chrisvel/tududi`）の
日付ベースの番号体系と混ざり、以下の問題があった：

1. 上流が同じ番号帯で新マイグレーションを追加すると、cherry-pick / merge 時に混乱する
2. 「自分が追加したもの」と「上流由来」がパッと見で区別できない

### 採用方針（案1: 末尾に強制的に並べる）

ファイル名の先頭に `yoshiaki21-` をつけることで、Sequelize のアルファベット順ソートで
**必ず上流マイグレーションの後（末尾）に実行される** ようにする。

- ASCII 順で数字 (`0-9`) → 英字 (`a-z`) のため、`y` 始まりは常に末尾
- どんなに上流が新しい migration を追加しても衝突しない
- `grep yoshiaki21` で自分の追加分が一発で抽出できる

### リネーム対象

```
backend/migrations/20260601000001-add-matrix-fields-to-users.js
  → backend/migrations/yoshiaki21-20260601000001-add-matrix-fields-to-users.js

backend/migrations/20260601000002-add-matrix-to-notification-preferences.js
  → backend/migrations/yoshiaki21-20260601000002-add-matrix-to-notification-preferences.js
```

### リネーム対象外（上流ファイルへの直接パッチ）

```
backend/migrations/20260509000001-ensure-notification-preferences.js
```

これは上流ファイルに JSON.parse のループ処理を追記しただけで、merge 時にコンフリクトを
解消する前提のため、ファイル名はそのまま維持する。

### 今後の運用ルール

- **新規マイグレーションを追加するとき**は必ず `yoshiaki21-YYYYMMDDxxxxxx-description.js` の形式にする
- **上流ファイルを直接修正するとき**はファイル名を変更しない（merge コンフリクトで気付けるように）
- リネーム時は **SequelizeMeta テーブル** の整合性に注意：
  - 既に DB に適用済みの場合、ファイル名を変えると Sequelize は「未適用」と判定して再実行しようとする
  - 開発環境では `SequelizeMeta` テーブルの該当行を新ファイル名に UPDATE するか、DB を作り直す
  - 本番環境では migration を行わずに `SequelizeMeta` 側を直接書き換える運用が安全

### 動作確認

```bash
ls backend/migrations/ | tail -3
# 20260509000001-ensure-notification-preferences.js
# yoshiaki21-20260601000001-add-matrix-fields-to-users.js
# yoshiaki21-20260601000002-add-matrix-to-notification-preferences.js
```

末尾に `yoshiaki21-` 始まりのファイルが並ぶことを確認。

---

## タスク5: Dockerfile の Alpine → Debian slim 移行

### 背景

`matrix-bot-sdk` は内部依存として `@matrix-org/matrix-sdk-crypto-nodejs` を持つ。
このパッケージは Rust 製のネイティブバイナリ（E2EE暗号化ライブラリ）を同梱しており、
実行時に **glibc（`ld-linux-x86-64.so.2`）を要求する**。

現在の Dockerfile は `node:22-alpine`（musl libc）をベースにしているため、
起動時に以下のエラーで即クラッシュし、コンテナが再起動ループに陥る：

```
Error: Error loading shared library ld-linux-x86-64.so.2: No such file or directory
(needed by matrix-sdk-crypto.linux-x64-musl.node)
code: 'ERR_DLOPEN_FAILED'
```

E2EE は初期実装では対応しないが、`@matrix-org/matrix-sdk-crypto-nodejs` は
optional ではないため `npm install` 時に必ず導入され、`require` 時にクラッシュする。
将来の E2EE 対応時にも同じ glibc 環境が必要なため、Alpine を廃止する。

### 対象ファイル

```
Dockerfile
scripts/docker-entrypoint.sh
```

### 修正内容

#### 1. ベースイメージの変更（builder / production 両ステージ）

```dockerfile
# 修正前
FROM node:22-alpine AS builder
# ...
FROM node:22-alpine AS production

# 修正後
FROM node:22-trixie-slim AS builder
# ...
FROM node:22-trixie-slim AS production
```

#### 2. builder ステージ：apk → apt-get

```dockerfile
# 修正前
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite-dev \
    sqlite \
    bash

# 修正後
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libsqlite3-dev \
    sqlite3 \
    bash \
    && rm -rf /var/lib/apt/lists/*
```

#### 3. production ステージ：apk → apt-get、su-exec → gosu

```dockerfile
# 修正前
RUN apk add --no-cache \
    bash \
    sqlite \
    dumb-init \
    su-exec && \
    rm -rf /tmp/* /var/cache/apk/*

# 修正後
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    sqlite3 \
    dumb-init \
    gosu \
    && rm -rf /var/lib/apt/lists/* /tmp/*
```

#### 4. addgroup / adduser → groupadd / useradd

Alpine の `addgroup` / `adduser` は Debian では使えないため、標準コマンドに変更する。

```dockerfile
# 修正前
RUN addgroup -g ${APP_GID} app && \
    adduser -D -u ${APP_UID} -G app app

# 修正後
RUN groupadd -g ${APP_GID} app && \
    useradd -u ${APP_UID} -g app -M -s /sbin/nologin app
```

#### 5. docker-entrypoint.sh の su-exec → gosu

`scripts/docker-entrypoint.sh` 内で `su-exec` を使用している箇所をすべて `gosu` に置き換える。

```bash
# 修正前
exec su-exec app "$@"

# 修正後
exec gosu app "$@"
```

### 注意事項

- `node:22-trixie-slim` は Debian 13 (Trixie) ベースで glibc 2.40 を搭載。イメージサイズは Alpine より若干大きくなる（+50〜100MB 程度）
- `gosu` は `su-exec` と同等の機能を持ち、Docker 公式が推奨するユーザー切り替えツール
- 将来 E2EE を有効化する場合も、このベースイメージで追加作業は不要

### 動作確認

```bash
# ビルド
docker build -t tududi-local .

# 起動確認（クラッシュループが解消されることを確認）
docker compose up

# ログに以下が出て、クラッシュしないことを確認
# ✅ Database connection successful
# （ERR_DLOPEN_FAILED が出ないこと）
```

---

## タスク6: Dockerfile ベースイメージを node:22-trixie-slim に修正

### 背景

タスク5 で `node:22-slim`（Debian 12 Bookworm、glibc 2.36）に移行したが、
`sqlite3` のプリビルドバイナリが **glibc 2.38 以上** を要求するため、
以下のエラーで引き続きクラッシュする：

```
Error: /lib/x86_64-linux-gnu/libm.so.6: version `GLIBC_2.38' not found
(required by node_sqlite3.node)
code: 'ERR_DLOPEN_FAILED'
```

`node:22-trixie-slim`（Debian 13 Trixie、glibc 2.40）に変更することで解決する。

### 対象ファイル

```
Dockerfile
```

### 修正内容

#### 1. 両ステージのベースイメージを変更

```dockerfile
# 修正前（タスク5 適用後の状態）
FROM node:22-slim AS builder
FROM node:22-slim AS production

# 修正後
FROM node:22-trixie-slim AS builder   # Debian 13 / glibc 2.40
FROM node:22-trixie-slim AS production
```

他の変更は不要。apt-get / gosu / groupadd 等はタスク5のままで動作する。

### 動作確認

```bash
# イメージを再ビルド（キャッシュを使わず）
docker build --no-cache -t tududi-local .

# 起動確認
docker compose up

# 以下が出てクラッシュしないことを確認
# ✅ Database connection successful
# ✅ Database status check completed
# （ERR_DLOPEN_FAILED が出ないこと）
```
