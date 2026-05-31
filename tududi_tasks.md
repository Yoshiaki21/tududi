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

---

## タスク7: Matrix E2EE（エンドツーエンド暗号化）対応 ✅ 完了（2026-05-30）

### 実施した変更

#### `backend/modules/matrix/matrixClient.js`
- `RustSdkCryptoStorageProvider` を `matrix-bot-sdk` の import に追加
- `./data/matrix-store/<userId>/crypto/` ディレクトリを自動作成してE2EE用ストレージを初期化
- `MatrixClient` コンストラクタの第4引数に `cryptoStorage` を渡してE2EEを有効化

#### `backend/modules/matrix/matrixPoller.js`
- `room.invite` イベントハンドラを追加（暗号化ルームへの招待を自動承諾）
- `client.start()` の後に `client.crypto.uploadDeviceKeys()` を呼び出してデバイスキーをサーバーに登録
- キー登録成功・失敗ともにログ出力を追加

#### `docker-compose.yml`
- `./data:/app/backend/data` ボリュームを追加し、crypto ディレクトリ（デバイスキー）をコンテナ再起動後も永続化

---

### 背景

現在の Matrix 連携（タスク2）は非暗号化ルームのみ対応している。
暗号化ルーム（Element で 🔒 マークが付くルーム）では以下の問題が発生する：

- 受信メッセージが復号できず無視される
- bot からの送信が暗号化されないため暗号化ルームで弾かれる

`@matrix-org/matrix-sdk-crypto-nodejs` はすでにインストール済みで、
`node:22-trixie-slim`（glibc 2.40）環境で動作可能な状態になっている。
このタスクでは `matrix-bot-sdk` の E2EE 機能を有効化し、暗号化ルームで動作させる。

### 使用するクラス

`matrix-bot-sdk` が提供する以下を使用する：

```javascript
const {
    MatrixClient,
    SimpleFsStorageProvider,
    RustSdkCryptoStorageProvider,  // E2EE用ストレージ（新規追加）
} = require("matrix-bot-sdk");
```

### 対象ファイル

```
backend/modules/matrix/matrixClient.js
backend/modules/matrix/matrixPoller.js
```

---

### 修正内容

#### 1. `backend/modules/matrix/matrixClient.js`

`RustSdkCryptoStorageProvider` を追加し、クライアント生成時に渡す。

```javascript
// 修正前
const { MatrixClient, SimpleFsStorageProvider } = require("matrix-bot-sdk");

function createMatrixClient(homeserverUrl, accessToken, userId) {
    const storageDir = `./data/matrix-store/${userId}`;
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }
    const storage = new SimpleFsStorageProvider(`${storageDir}/state.json`);
    return new MatrixClient(homeserverUrl, accessToken, storage);
}

// 修正後
const {
    MatrixClient,
    SimpleFsStorageProvider,
    RustSdkCryptoStorageProvider,
} = require("matrix-bot-sdk");

function createMatrixClient(homeserverUrl, accessToken, userId) {
    const storageDir = `./data/matrix-store/${userId}`;
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }
    const storage = new SimpleFsStorageProvider(`${storageDir}/state.json`);

    // E2EE用ストレージを追加（デバイスキー・セッションキーを永続化）
    const cryptoDir = `${storageDir}/crypto`;
    if (!fs.existsSync(cryptoDir)) {
        fs.mkdirSync(cryptoDir, { recursive: true });
    }
    const cryptoStorage = new RustSdkCryptoStorageProvider(cryptoDir);

    return new MatrixClient(homeserverUrl, accessToken, storage, cryptoStorage);
}
```

#### 2. `backend/modules/matrix/matrixPoller.js`

`client.start()` の前にデバイスキーの登録と、暗号化ルームへの対応処理を追加する。

```javascript
// 修正前
async function start(userId) {
    // ... クライアント生成 ...
    client.on("room.message", async (roomId, event) => {
        // ... メッセージ処理 ...
    });
    await client.start();
}

// 修正後
async function start(userId) {
    // ... クライアント生成 ...

    // E2EE: デバイスキーをサーバーに登録（初回のみ実行される）
    await client.crypto.uploadDeviceKeys();

    client.on("room.message", async (roomId, event) => {
        if (processedEvents.has(event.event_id)) return;
        processedEvents.add(event.event_id);

        if (event.sender === botUserId) return;
        if (event.type !== "m.room.message") return;

        // E2EE: 復号済みイベントかどうかに関わらず body を取得
        // matrix-bot-sdk は E2EE 有効時に自動復号してくれるため、
        // event.content.body をそのまま使えば暗号化・非暗号化どちらも動作する
        const text = event.content?.body;
        if (!text) return;

        await processMessage(user, { roomId, text, sender: event.sender });
    });

    // E2EE: 暗号化ルームへの招待を自動承諾（任意・セキュリティ要件に応じて判断）
    client.on("room.invite", async (roomId, inviteEvent) => {
        await client.joinRoom(roomId);
    });

    await client.start();
}
```

### 注意事項

#### デバイスキーの永続化について

`RustSdkCryptoStorageProvider` に指定したディレクトリ（`./data/matrix-store/<userId>/crypto/`）に
デバイスキーが保存される。このディレクトリが消えると別デバイスとして扱われ、
過去の暗号化メッセージが復号できなくなる。

Docker ボリューム設定で `./data/` も永続化されているか確認すること：

```yaml
# docker-compose.yml（確認）
volumes:
  - ./data:/app/backend/data   # matrix-store もここに含まれること
```

含まれていない場合は追加する。

#### 既存の非暗号化ルームへの影響

E2EE を有効化しても非暗号化ルームは引き続き動作する。
`matrix-bot-sdk` は暗号化・非暗号化を自動判別するため、コードの分岐は不要。

#### 初回起動時の動作

初回 `client.start()` 時にデバイスキーの生成とサーバーへの登録が行われる。
この処理には数秒かかる場合があるが、以降は永続化されたキーを再利用する。

### 動作確認手順

1. Element でテスト用の**暗号化ルーム**を新規作成（ルーム作成時に暗号化を有効にする）
2. bot アカウントをルームに招待
3. bot が参加したことを確認（🔒 マークが表示されていること）
4. ルームからテキストを送信
5. tududi Web UI の Inbox にアイテムが追加されることを確認
6. bot からの返信メッセージも暗号化されて届くことを確認（Element で 🔒 マークが付くこと）

```bash
# 動作確認時のログ監視
docker compose logs -f tududi | grep -i matrix
```

以下のようなログが出れば E2EE が正常に初期化されている：

```
Matrix: crypto initialized for user 1
Matrix: device keys uploaded for user 1
```

---

## タスク8: matrixPoller.js の Stop/Start 動作修正

### 背景

Profile 画面の Matrix 設定で Stop → 設定変更（Room ID等）→ Start を行った場合に
以下の2つの問題が発生することを確認した：

1. **`client.crypto.uploadDeviceKeys is not a function`**
   タスク7で追加した `uploadDeviceKeys()` の呼び出しが `matrix-bot-sdk` の実際の
   API と一致しない。E2EE 自体は自動初期化されるため、この呼び出しは不要で削除する。

2. **Stop → Start で `M_UNKNOWN: Internal server error` が発生しクライアントが起動しない**
   `stop()` で旧クライアントが完全に破棄されないまま `start()` で新クライアントを
   生成するため、crypto セッションが競合してサーバー側でエラーになる。

3. **Stop → Start 後も変更前の設定（Room ID等）が使われる**
   `start()` がキャッシュ済みのユーザー情報を使うため、DB に保存した最新設定が
   反映されない。

### 対象ファイル

```
backend/modules/matrix/matrixPoller.js
```

### 修正内容

#### 1. `uploadDeviceKeys()` の呼び出しを削除

E2EE は `client.start()` 時に自動初期化される。明示的な呼び出しは不要なため削除する。

```javascript
// 削除する行
await client.crypto.uploadDeviceKeys();
```

#### 2. `stop()` に待機処理を追加

クライアント停止後、crypto ストレージのロックが解放されるまで待機する。

```javascript
// 修正前
async function stop(userId) {
    const client = activeClients.get(userId);
    if (client) {
        await client.stop();
        activeClients.delete(userId);
    }
}

// 修正後
async function stop(userId) {
    const client = activeClients.get(userId);
    if (client) {
        await client.stop();
        activeClients.delete(userId);
        // crypto ストレージのロック解放を待つ（新クライアントとの競合防止）
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}
```

#### 3. `start()` で DB から最新設定を取得

キャッシュではなく DB から取得することで、Stop → 設定変更 → Start が
再起動なしで反映されるようにする。

```javascript
// 修正前
async function start(userId) {
    const user = activeUsers.get(userId);  // キャッシュから取得
    // ...
}

// 修正後
async function start(userId) {
    // 型を整数に統一（stop() との型不一致を防ぐ）
    const numericId = Number(userId);
    const user = await User.findByPk(numericId);
    if (!user || !user.matrix_access_token) return;
    // ... 以降は既存の処理をそのまま使用
}
```

#### 4. イベントハンドラ内で Room ID を毎回 DB から取得

**問題**: `start()` で DB から `user` を取得しても、イベントハンドラ内の
`user.matrix_room_id` はクロージャにより `start()` 実行時点の値に固定される。
そのため Room ID を変更して再起動しても、古い Room ID でフィルタされ続ける。

**原因の流れ**:
1. Room ID を変更して保存
2. docker compose restart または Stop → Start
3. `start()` で DB から新しい `user` を取得 ← ここは正しい
4. しかし `room.message` ハンドラ内の `user` は古いオブジェクトのまま
5. `roomId !== user.matrix_room_id` の判定で新 Room ID のメッセージが弾かれる

Access Token を入れ直すと動作するのは、保存処理後の `start()` で新しい
`user` オブジェクトがクロージャに取り込まれるためで、根本解決ではない。

```javascript
// 修正前
client.on('room.message', async (roomId, event) => {
    // user はクロージャで固定されているため Room ID 変更が反映されない
    if (user.matrix_room_id && roomId !== user.matrix_room_id) return;
    if (user.matrix_bot_user_id && event.sender === user.matrix_bot_user_id) return;
    // ...
    await processMessage(user, { roomId, text, sender: event.sender, eventId: event.event_id });
});

// 修正後
client.on('room.message', async (roomId, event) => {
    // 毎回 DB から最新設定を取得（Room ID 変更を即反映）
    const currentUser = await User.findByPk(user.id);
    if (!currentUser) return;

    if (currentUser.matrix_room_id && roomId !== currentUser.matrix_room_id) return;
    if (currentUser.matrix_bot_user_id && event.sender === currentUser.matrix_bot_user_id) return;

    if (event.type !== 'm.room.message') return;
    if (event.content?.msgtype !== 'm.text') return;

    if (seen.has(event.event_id)) return;
    seen.add(event.event_id);

    if (seen.size > 1000) {
        const oldest = Array.from(seen).slice(0, 100);
        oldest.forEach((id) => seen.delete(id));
    }

    const text = event.content?.body;
    if (!text) return;

    // currentUser を使って processMessage を呼び出す
    await processMessage(currentUser, {
        roomId,
        text,
        sender: event.sender,
        eventId: event.event_id,
    });
});
```

### 期待される動作

- Stop → Start でクライアントが正常に再起動する（`M_UNKNOWN` が出ない）
- Room ID を変更 → 保存 → Stop → Start で**再起動なしに新しい Room ID が反映される**
- Room ID を変更しても Access Token を入れ直さなくて済む
- `client.crypto.uploadDeviceKeys is not a function` エラーが出なくなる

### 動作確認

```bash
# Stop → Room ID 変更・保存 → Start 後にログを確認
docker compose logs tududi | grep -i matrix

# 以下が出て、エラーなく起動することを確認
# Matrix: stopped client for user 1
# Matrix: started client for user 1
# （M_UNKNOWN が出ないこと）

# 新しい Room ID のルームからメッセージを送信して Inbox に追加されることを確認
```

---

## タスク9: MatrixTab UI改善（保存ボタン統一 ＋ タスクサマリー通知設定追加）

### 背景

Matrix 設定画面に以下の2つの問題がある：

1. **保存ボタンが2つ存在する**
   「Save Matrix Settings」と「変更を保存」の2つがあり混乱を招く。
   Profile 画面全体の「変更を保存」に統一する。

2. **タスクサマリー通知の設定UIがない**
   Telegram タブにはタスクサマリー通知のトグル・頻度選択・テスト送信ボタンがあるが、
   Matrix タブには同等の UI がない。バックエンドの送信処理は実装済みのため、
   フロントエンドの UI とテスト送信エンドポイントを追加する。

### 対象ファイル

```
frontend/components/Profile/tabs/MatrixTab.tsx
backend/modules/matrix/routes.js
backend/modules/matrix/controller.js
```

---

### 修正内容

#### 1. `frontend/components/Profile/tabs/MatrixTab.tsx`

##### 1-1. 「Save Matrix Settings」ボタンを削除

Profile 画面全体の「変更を保存」ボタンに統一する。

```tsx
// 削除するボタン
<button
    onClick={handleSave}
    className="..."
>
    Save Matrix Settings
</button>
```

##### 1-2. タスクサマリー通知セクションを追加

`TelegramTab.tsx` のタスクサマリーセクションを参考に、同等の UI を Matrix タブに追加する。

追加する UI 要素：

| 要素 | 内容 |
|---|---|
| セクションヘッダー | 「タスクサマリー通知」（Telegram と同じスタイル） |
| 説明文 | 「Matrix を通じて定期的にタスクのサマリーを受け取ります」 |
| 有効/無効トグル | `task_summary_enabled` に対応 |
| 頻度選択 | 1時間 / 2時間 / 4時間 / 8時間 / 12時間 / 1日 / 1週間 |
| テスト送信ボタン | `/api/matrix/test-summary` を呼び出す |
| エラー表示 | Matrix 連携が未設定の場合に警告メッセージを表示 |

実装は `TelegramTab.tsx` のサマリーセクションと同じパターンで、
API エンドポイントのパスを `/api/telegram/...` → `/api/matrix/...` に変更する。

---

#### 2. `backend/modules/matrix/routes.js`

Telegram の `routes.js` を参考に、テスト送信用エンドポイントを追加する。

```javascript
// 追加するルート
router.post('/test-summary', controller.testSummary);
```

---

#### 3. `backend/modules/matrix/controller.js`

Telegram の `controller.js` の `testSummary` 関数を参考に実装する。

```javascript
// 追加する関数
async testSummary(req, res) {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId);

        if (!user.matrix_access_token || !user.matrix_room_id) {
            return res.status(400).json({
                error: 'Matrix integration is not configured'
            });
        }

        // matrixNotificationService を使ってテストメッセージを送信
        await matrixNotificationService.sendMessage(
            user.matrix_homeserver_url,
            user.matrix_access_token,
            user.matrix_room_id,
            '📋 This is a test summary from tududi!'
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
```

### 期待される動作

- Matrix 設定画面の「Save Matrix Settings」ボタンが消え、「変更を保存」のみになる
- Telegram タブと同等のタスクサマリー通知設定が Matrix タブに表示される
- 「テスト送信」ボタンを押すと Matrix ルームにテストメッセージが届く
- Matrix 未設定時はテスト送信ボタンが無効化またはエラーメッセージが表示される

### 動作確認

1. Profile → Matrix タブで「Save Matrix Settings」ボタンが消えていることを確認
2. タスクサマリー通知セクションが表示されていることを確認
3. テスト送信ボタンを押して Matrix ルームにメッセージが届くことを確認
4. 「変更を保存」でサマリー設定（有効/無効・頻度）が保存されることを確認

---

## タスク10: 工数管理機能の追加（作業時間記録・プロジェクト集計・人工計算）

### 背景

プロジェクトを仕事の単位として使い、タスクに作業時間を記録し、
プロジェクトごとの工数・人工・費用を把握したい。

具体的なユースケース：
- プロジェクト = 1案件（例：小松(7)分散パッド）
- タスク = 1日程度の作業単位（例：FH計画と排水計算）
- サブタスク = ToDoリスト（例：排水計算、FH計画平面図）
- タスクに作業時間を手入力（例：1.5 = 1時間30分）
- プロジェクト画面で合計時間・人工・費用を確認

### 対象ファイル

```
# DB マイグレーション（新規）
backend/migrations/yoshiaki21-YYYYMMDD000001-add-work-hours-to-tasks.js
backend/migrations/yoshiaki21-YYYYMMDD000002-add-work-hours-fields-to-projects.js
backend/migrations/yoshiaki21-YYYYMMDD000003-add-default-unit-price-to-users.js

# モデル
backend/models/Task.js
backend/models/Project.js
backend/models/User.js

# バックエンド
backend/routes/tasks.js        （または tasks コントローラ）
backend/routes/projects.js     （または projects コントローラ）
backend/routes/users.js        （または profile コントローラ）

# フロントエンド
frontend/components/TaskDetail/TaskDetail.tsx  （または同等のタスク詳細コンポーネント）
frontend/components/Project/ProjectDetail.tsx  （または同等のプロジェクト詳細コンポーネント）
frontend/components/Project/WorkSummaryCard.tsx（新規作成）
frontend/components/Profile/tabs/GeneralTab.tsx（または同等の一般設定タブ）
frontend/components/Project/ProjectModal.tsx   （または新規作成モーダル）
```

実際のファイルパスは Claude Code がコードベースを参照して確認すること。

---

### 修正内容

#### 1. DB マイグレーション

##### tasks テーブルに `work_hours` カラムを追加

```javascript
// yoshiaki21-YYYYMMDD000001-add-work-hours-to-tasks.js
await queryInterface.addColumn('Tasks', 'work_hours', {
    type: Sequelize.FLOAT,
    allowNull: true,
    defaultValue: null,
});
```

##### projects テーブルに `unit_price` カラムを追加

```javascript
// yoshiaki21-YYYYMMDD000002-add-work-hours-fields-to-projects.js
await queryInterface.addColumn('Projects', 'unit_price', {
    type: Sequelize.INTEGER,
    allowNull: true,
    defaultValue: null,  // null の場合はユーザーのデフォルト単価を使用
});
```

##### users テーブルに `default_unit_price` カラムを追加

```javascript
// yoshiaki21-YYYYMMDD000003-add-default-unit-price-to-users.js
await queryInterface.addColumn('Users', 'default_unit_price', {
    type: Sequelize.INTEGER,
    allowNull: true,
    defaultValue: 25000,
});
```

---

#### 2. モデル更新

##### Task.js

```javascript
// 追加フィールド
work_hours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null,
},
```

##### Project.js

```javascript
// 追加フィールド
unit_price: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
},
description: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
},
```

##### User.js

```javascript
// 追加フィールド
default_unit_price: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 25000,
},
```

---

#### 3. バックエンド API

##### プロジェクトの工数集計エンドポイントを追加

既存のプロジェクト取得 API（`GET /api/projects/:id`）のレスポンスに
以下の集計値を含める（または別途 `GET /api/projects/:id/work-summary` を追加）：

```javascript
// レスポンスに追加する集計値
{
    total_work_hours: 12.5,      // プロジェクト内の全タスクの work_hours 合計
    // null の task は集計から除外
}
```

集計クエリ例：

```javascript
const totalWorkHours = await Task.sum('work_hours', {
    where: {
        project_id: projectId,
        work_hours: { [Op.not]: null },
    },
});
```

##### tasks / projects の CRUD に新フィールドを追加

- Task の作成・更新で `work_hours` を受け付ける
- Project の作成・更新で `unit_price`・`description` を受け付ける
- User の Profile 更新で `default_unit_price` を受け付ける

---

#### 4. フロントエンド

##### 4-1. タスク詳細画面に「作業時間」入力欄を追加

表示位置：期限日（Due Date）の**上**

```tsx
{/* 作業時間入力欄 - 期限日の上に配置 */}
<div className="work-hours-field">
    <label>作業時間</label>
    <input
        type="number"
        step="0.5"
        min="0"
        placeholder="例: 1.5"
        value={task.work_hours ?? ''}
        onChange={(e) => handleUpdate('work_hours',
            e.target.value === '' ? null : parseFloat(e.target.value)
        )}
    />
    <span className="unit">h</span>
</div>
```

- 入力は手入力（自由入力）
- 小数第1位（0.1刻み）
- 未入力（null）は集計から除外
- 入力値は既存のタスク更新 API に乗せて保存

##### 4-2. プロジェクト詳細画面に「作業時間集計カード」を追加

表示位置：右カラムの**期限スケジュールカードの上**

新規コンポーネント `WorkSummaryCard.tsx` として作成する。

```tsx
// WorkSummaryCard の表示内容
// unit_price は project.unit_price ?? user.default_unit_price で解決

const manDays = totalWorkHours / 8;  // 8時間 = 1人工
const unitPrice = project.unit_price ?? userDefaultUnitPrice;
const totalCost = manDays * unitPrice;

// 表示
作業時間集計
合計: {totalWorkHours.toFixed(1)}h
人工: {manDays.toFixed(1)}人工
単価: ¥{unitPrice.toLocaleString()}/人工
金額: ¥{totalCost.toLocaleString()}
```

- `totalWorkHours` が 0 または null のみの場合は「作業時間が記録されていません」と表示
- 単価入力欄をカード内に設ける（変更すると金額がリアルタイムで再計算される）
- 単価の変更は `PATCH /api/projects/:id`（`unit_price` フィールド）で保存

単価入力欄のイメージ：

```
┌─────────────────────────────────┐
│ 作業時間集計                      │
│ 合計: 12.5h                      │
│ 人工: 1.6人工                     │
│ 単価: [¥ 25,000] /人工  [変更保存] │
│ 金額: ¥40,000                    │
└─────────────────────────────────┘
```

##### 4-3. プロジェクト概要欄を追加

表示位置：プロジェクト詳細画面の左カラム、「新しいタスクを追加」ボタンの**上**

タスクの概要欄と同じ実装パターンを使用する：
- Markdown 対応（表示時はレンダリング、編集時はテキストエリア）
- Markdown チェックボックスはタスク1で実装したものと同様にクリック可能にする
- 編集モードの切り替えはダブルクリック（タスクの概要欄と同じ UX）
- 保存は `PATCH /api/projects/:id`（`description` フィールド）

##### 4-4. Profile 画面「一般」タブにデフォルト人工単価を追加

表示位置：一般タブの**下部**に追加

```tsx
{/* デフォルト人工単価 */}
<div className="setting-field">
    <label>デフォルト人工単価</label>
    <div className="input-with-unit">
        <span>¥</span>
        <input
            type="number"
            min="0"
            step="1000"
            value={defaultUnitPrice}
            onChange={(e) => setDefaultUnitPrice(parseInt(e.target.value))}
        />
        <span>/人工</span>
    </div>
    <p className="hint">プロジェクト新規作成時の初期値として使用されます</p>
</div>
```

- 「変更を保存」ボタンで既存の Profile 更新 API に乗せて保存

##### 4-5. プロジェクト新規作成モーダルに人工単価を追加

プロジェクト作成モーダルに単価入力欄を追加する。

- 初期値は `user.default_unit_price`（Profile 設定値）を自動入力
- 未入力の場合は null として保存（表示時に `default_unit_price` にフォールバック）

---

### 実装上の注意

#### 人工単価の優先順位

```
表示時の単価 = project.unit_price ?? user.default_unit_price ?? 25000
```

1. プロジェクト個別設定値（`project.unit_price`）
2. ユーザーのデフォルト設定値（`user.default_unit_price`）
3. システムデフォルト（25,000円）

#### 集計対象

- `work_hours` が `null` のタスクは集計から除外
- 完了・未完了問わず `work_hours` が入力されているタスクすべてを集計
- サブタスクは集計対象外（タスク単位で集計）

#### マイグレーションプレフィックス

タスク4のルールに従い、マイグレーションファイル名に `yoshiaki21-` プレフィックスを付ける。

---

### 動作確認

1. タスク詳細画面で「作業時間」欄が期限日の上に表示されることを確認
2. 作業時間（例: `1.5`）を入力・保存してリロード後も値が残ることを確認
3. プロジェクト画面で「作業時間集計」カードが期限スケジュールの上に表示されることを確認
4. 集計値（合計h・人工・金額）が正しく計算されることを確認
5. 単価を変更すると金額がリアルタイムで再計算されることを確認
6. プロジェクト概要欄に Markdown テキストを入力・保存できることを確認
7. Profile → 一般タブでデフォルト人工単価が保存できることを確認
8. プロジェクト新規作成モーダルでデフォルト単価が初期入力されていることを確認
