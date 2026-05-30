# tududi Matrix Bot セットアップ手順書

## 概要

tududi の Matrix 連携に必要な bot アカウント・ルームをコマンドラインのみで作成する手順。
対象サーバー: `https://matrix.gskraft.com`

すべての操作は `curl` コマンドで完結する。ブラウザ（Element 等）は不要。

---

## 事前準備

### 変数の整理

以下の値を手元に用意してから作業を進めると、コマンドのコピペがしやすい。

| 変数 | 説明 | 例 |
|---|---|---|
| `ADMIN_USER` | 管理アカウントのユーザー名 | `yoshiaki` |
| `ADMIN_PASS` | 管理アカウントのパスワード | `your_password` |
| `BOT_USER` | bot アカウントのユーザー名 | `tududi-bot` |
| `BOT_PASS` | bot アカウントに設定するパスワード | `bot_password` |
| `HOMESERVER` | Matrix サーバーの URL | `https://matrix.gskraft.com` |

---

## 手順1: 管理アカウントのアクセストークン取得

### 概要

Matrix の API はすべてアクセストークンによる認証が必要。
まず管理アカウント（自分のアカウント）でログインしてトークンを取得する。

### コマンド

```bash
curl -XPOST \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "yoshiaki",
    "password": "your_password"
  }' \
  'https://matrix.gskraft.com/_matrix/client/v3/login'
```

### レスポンス例

```json
{
  "access_token": "syt_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "device_id": "ABCDEFGHIJ",
  "home_server": "matrix.gskraft.com",
  "user_id": "@yoshiaki:matrix.gskraft.com"
}
```

### 取得する値

- `access_token` → 以降の手順で `ADMIN_TOKEN` として使用

---

## 手順2: bot アカウントの作成

### 概要

Matrix サーバーに bot 専用のユーザーアカウントを新規作成する。
Synapse サーバーの場合、管理者 API を使って登録する。

### コマンド

```bash
curl -XPUT \
  -H "Authorization: Bearer syt_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "bot_password",
    "displayname": "Tududi Bot",
    "admin": false
  }' \
  'https://matrix.gskraft.com/_synapse/admin/v2/users/@tududi-bot:matrix.gskraft.com'
```

### レスポンス例（新規作成時）

```json
{
  "name": "@tududi-bot:matrix.gskraft.com",
  "displayname": "Tududi Bot",
  "admin": false,
  "deactivated": false
}
```

### 補足

- `_synapse/admin/v2/users/` は Synapse サーバー専用の管理 API
- PUT メソッドで「存在しなければ作成、存在すれば更新」の動作をする
- `admin: false` にすることで一般ユーザーとして作成される

---

## 手順3: bot アカウントのアクセストークン取得

### 概要

作成した bot アカウントでログインして、tududi に登録するためのアクセストークンを取得する。
このトークンが tududi の Profile 画面に登録する値になる。

### コマンド

```bash
curl -XPOST \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "tududi-bot",
    "password": "bot_password"
  }' \
  'https://matrix.gskraft.com/_matrix/client/v3/login'
```

### レスポンス例

```json
{
  "access_token": "syt_dHVkdWRpX2JvdA_xxxxxxxxxxxxxxxxxxxxxxxx",
  "device_id": "TUDUDI_DEVICE",
  "home_server": "matrix.gskraft.com",
  "user_id": "@tududi-bot:matrix.gskraft.com"
}
```

### 取得する値

- `access_token` → tududi の **Access Token** に登録
- `user_id` → tududi の **Bot User ID** に登録（`@tududi-bot:matrix.gskraft.com`）

---

## 手順4: ルームの作成

### 概要

tududi 専用のルームを作成する。管理アカウントのトークンで作成し、
bot を後から招待する。

暗号化ルームと非暗号化ルームで作成方法が異なる。

### 非暗号化ルームの場合

```bash
curl -XPOST \
  -H "Authorization: Bearer syt_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tududi Inbox",
    "topic": "tududi タスク管理用ルーム",
    "preset": "private_chat",
    "visibility": "private"
  }' \
  'https://matrix.gskraft.com/_matrix/client/v3/createRoom'
```

### 暗号化ルームの場合

```bash
curl -XPOST \
  -H "Authorization: Bearer syt_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tududi Inbox",
    "topic": "tududi タスク管理用ルーム（暗号化）",
    "preset": "private_chat",
    "visibility": "private",
    "initial_state": [
      {
        "type": "m.room.encryption",
        "state_key": "",
        "content": {
          "algorithm": "m.megolm.v1.aes-sha2"
        }
      }
    ]
  }' \
  'https://matrix.gskraft.com/_matrix/client/v3/createRoom'
```

### レスポンス例

```json
{
  "room_id": "!hmRszePSicwQRvkoNO:matrix.gskraft.com"
}
```

### 取得する値

- `room_id` → tududi の **Room ID** に登録（`!hmRszePSicwQRvkoNO:matrix.gskraft.com`）

---

## 手順5: bot アカウントをルームに参加させる

### 概要

作成したルームに bot を参加させる。
「管理アカウントが bot を招待」→「bot が承諾」の2ステップで行う。

### ステップ1: 管理アカウントから bot を招待

```bash
curl -XPOST \
  -H "Authorization: Bearer syt_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"@tududi-bot:matrix.gskraft.com"}' \
  'https://matrix.gskraft.com/_matrix/client/v3/rooms/!hmRszePSicwQRvkoNO:matrix.gskraft.com/invite'
```

成功時は `{}` が返る。

### ステップ2: bot アカウントで招待を承諾（ルームに参加）

```bash
curl -XPOST \
  -H "Authorization: Bearer syt_dHVkdWRpX2JvdA_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{}' \
  'https://matrix.gskraft.com/_matrix/client/v3/join/!hmRszePSicwQRvkoNO:matrix.gskraft.com'
```

### 補足

- URL に `!` が含まれるため、必ずシングルクォート `'` で URL を囲むこと
- ダブルクォートで囲むと bash が `!` を履歴展開として解釈してエラーになる

---

## 手順6: tududi に登録する情報まとめ

手順1〜5で取得した値を tududi の Profile 画面 → Matrix タブに登録する。

| 項目 | 値 | 取得手順 |
|---|---|---|
| **Homeserver URL** | `https://matrix.gskraft.com` | 固定値 |
| **Access Token** | `syt_dHVkdWRpX2JvdA_xxx...` | 手順3 |
| **Bot User ID** | `@tududi-bot:matrix.gskraft.com` | 手順3 |
| **Room ID** | `!hmRszePSicwQRvkoNO:matrix.gskraft.com` | 手順4 |
| **Allowed Users** | `@yoshiaki:matrix.gskraft.com` | 自分の Matrix ID |

設定保存後、tududi を再起動して反映させる：

```bash
docker compose restart tududi
```

---

## 注意事項

### アクセストークンの再取得が必要なケース

以下の操作を行った場合、bot のアクセストークンが無効になる。
手順3を再実行して新しいトークンを取得し、tududi の Profile 画面で更新すること。

- bot アカウントの全デバイスを削除した場合
- `./data/matrix-store/` 以下の crypto ディレクトリを削除した場合
- bot アカウントのパスワードを変更した場合

### E2EE ルームでの注意

暗号化ルームに変更した場合は必ず tududi を再起動すること。
起動時にルーム情報を読み込むため、再起動しないと古いルームを監視し続ける。

```bash
docker compose restart tududi
# 確認
docker compose logs tududi | grep -i matrix
```
