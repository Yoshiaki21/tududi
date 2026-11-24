# tududi 改修作業指示書

<!-- 未着手・進行中のタスクをここに記載する -->
<!-- 完了したタスクは tududi_tasks_done.md に移動すること -->

## タスク28: 本家 v2 への移行（SQLite → PostgreSQL）

- **作成日**: 2026-11-24
- **目標**: 本家 v2.1.3（2026-11-23 時点の最新）に独自機能を載せ、本番を PostgreSQL に移す
- **前提**: 本番は v1.14.0 ＋ 独自変更で、SQLite（`tududi_db`）で動いている
- **方針（2026-11-24 決定）**: まず今のサーバーを v1.15.1 に上げる。v2 は新しいサーバーを立て、compose 同梱の `postgres:16-alpine` で動かし、データを移す

### 調査で分かったこと

- **v2 は既存の SQLite をそのまま引き継げない。** JSON バックアップでエクスポートし、新しい PostgreSQL の環境にインポートする（本家 `docs/30-moving-to-postgres.md`）
- **最後の 1.x は v1.15.1。v1.15 は移行のための中継版。** v1.14 のエクスポートには、コメント・リアクション・タスクの関連・デイリープラン・カレンダーフィード・Webhook・並び順が入らない（v1.15.0 の `e1280ee8` で追加された）。v1.15 は本家 main とは別のブランチにある
- **v2 は空の DB をモデルから作る**（`backend/scripts/db-prepare.js`）
  - `sequelize.sync()` を実行し、`migrations/` と `migrations/archive/` のファイル名をすべて適用済みとして記録する
  - 独自カラム（`work_hours`, `unit_price`, `default_unit_price`, `matrix_*`, `matrix_recovery_key`）はすべてモデルにある。なので独自マイグレーションは**実行しなくても**、新しい DB にカラムができる
  - 既存の DB では、`archive` 内で名前順が最後のファイルが適用済みかを確かめている。`yoshiaki21-*` を `archive` に移すと、名前順の最後が独自マイグレーションになる。新規 DB だけを使う今回の手順では問題ない
- **インポート後は、すべての行の数値 ID が振り直される。** Matrix の暗号ストアは `matrix-store/<userId>` という数値 ID のフォルダなので、新しい ID に合わせて名前を変える必要がある
- **v2 には `DB_FILE` が無い。** `matrixClient.js` はストアの場所を `DB_FILE` のディレクトリから決めているので、このままだとコンテナ内の `backend/db` に置かれ、再起動で消える
- **本家の Dockerfile は `node:22-alpine`。** 独自版は Node 24 が必須で、タスク5の判断で glibc（Debian）を使っている
- **独自変更と本家 v1.14 → v2.1.3 の変更が重なるファイルは 21 個**
  - インフラ: `Dockerfile`, `docker-compose.yml`, `scripts/docker-entrypoint.sh`, `.github/workflows/{ci,upgrade-docker}.yml`, `package.json`, `.gitignore`
  - backend: `app.js`, `models/notification.js`, `modules/projects/{repository,service}.js`, `modules/tasks/{routes,taskScheduler}.js`, `services/userDataTransfer.js`, `tests/integration/backup-roundtrip.test.js`
  - frontend: `Notes.tsx`, `Profile/types.ts`, `Project/{ProjectDetails,ProjectItem}.tsx`, `Task/TaskModal.tsx`, `entities/Project.ts`
- 独自の backend コードに SQLite 固有の SQL は無い。`work_hours` は FLOAT なので、PostgreSQL でも数値のまま返る（DECIMAL だと文字列になるが、該当しない）

### 段階1: v1.15.1 を取り込む（中継版）

1. ブランチ `merge-upstream-v1.15.1` を作り、`upstream/v1.15.1` をマージする（本家側の差分は 50 ファイル）
2. コンフリクトは `userDataTransfer.js`, `projects/service.js`, `package.json` の3つ。`// yoshiaki21:` の箇所を残す
3. `backup-roundtrip.test.js` で独自項目が往復することを確かめ、lint・tsc・backend・frontend のテストを通す
4. 本番に反映して動作を確かめる。この段階の DB はまだ SQLite のまま
   - v1.14.0 → v1.15.1 では、マイグレーション・モデル・Dockerfile・起動スクリプトに変更が無い。なので、独自イメージを作り直してタグを上げ、コンテナを入れ替えるだけで済む（`build.sh` のタグを `1.15.1` にする）
   - 念のため、入れ替え前に `tududi_db` をコピーしておく
5. 本番で、管理者アカウントからバックアップを1つエクスポートし、段階2の試験データにする（本番移行用のエクスポートは段階3で取り直す）

**進捗 (2026-11-24)**
- 1〜3 済み: `merge-upstream-v1.15.1` に `d5a869a9` としてマージ。コンフリクトは出ず自動マージ。`// yoshiaki21:` の 7 か所はすべて残っている
- 検証（Node 24）: lint エラー 0、tsc OK、backend 全スイート通過、frontend は既知の 3 件（MermaidDiagram / roleLabels / MarkdownRenderer.publicLinks）のみ失敗。試験イメージを空の DB で起動し、独自マイグレーション 9 件の適用、`Server running`、`/api/health` 200、バージョン `v1.15.1` を確認
- 残り: 4（本番反映）と 5（エクスポート）

### 段階2: v2.1.3 を取り込む

ブランチ `merge-upstream-v2.1.3` を作り、`upstream/v2.1.3` をマージする。

- **Dockerfile**: v2 版をもとに、ベースを `node:24-trixie-slim` にする。`apk` → `apt-get`、`su-exec` → `gosu` など、タスク5と同じ置き換えをする。v2 で SQLite 関連が消えたので、その部分は v2 版に合わせる
  - alpine に戻すとコンフリクトは減る。crypto-nodejs 0.6.1 以降には musl 用のバイナリもあるが、SDK 本体が glibc を要求するかは未検証。今回は対象外とする
- **マイグレーション**: `backend/migrations/yoshiaki21-*`（9 ファイル）を `backend/migrations/archive/` に移す。v2 の新規 DB ではモデルから作られるので不要になる
  - v2 以降に独自マイグレーションを追加するときは、これまでどおり `migrations/` に `yoshiaki21-` 付きで置く（新規 DB では適用済みとして記録され、既存 DB では実行される）
  - MY_CLAUDE.md のマイグレーション命名規則にこの点を書き足す
- **Matrix の暗号ストア**: `matrixClient.js` のストアの場所を環境変数 `MATRIX_STORE_DIR` で指定できるようにする（Docker での既定値は `/app/matrix-store`）。`DB_FILE` を使う分岐と、旧 `data/matrix-store` からの移動処理は消す
- **docker-compose.yml**: v2 版（postgres サービス付き）をもとに、`build:` と `image: registry.gskraft.com/tududi:...` の行を戻す。`./matrix-store:/app/matrix-store` のボリュームを足す
- **docker-entrypoint.sh**: v2 版をもとに、Debian 用の置き換え（`userdel` / `groupdel` / `gosu`）を入れ直す。`/app/matrix-store` の所有者も揃える
- **CI**: v2 の PostgreSQL 構成のまま、`node-version` を 24 にする
- **userDataTransfer.js**: v2 版に `// yoshiaki21:` の変更を入れ直す（エクスポートとインポートの両方）
- **backend の残り**: `app.js`（Matrix とクリーンアップのルート登録、Matrix ポーリングの開始）、`models/notification.js`（matrix チャネル）、`projects/*`（工数・金額）、`tasks/*`。v2 版に独自の追加を載せ直す
- **frontend**: 「本家版をもとに独自機能を移植する」方針（MY_CLAUDE.md）に沿って、6 ファイルを解決する
- **開発環境**: テストに PostgreSQL が必要になる。`podman run -d -p 5432:5432 -e POSTGRES_PASSWORD=... postgres:16-alpine` で立てて、`DATABASE_URL` を設定する
- **確認**
  - lint、tsc、backend・frontend のテストを PostgreSQL 上で通す
  - `backup-roundtrip` で、v1.15.1 のエクスポートを v2 にインポートしても独自項目が残ることを確かめる（段階1で作ったファイルを fixture にする）
  - 試験コンテナが Node 24 と PostgreSQL で起動すること

### 段階3: 新しいサーバーに v2 を立てて移す

1. 新しいサーバーに v2 の独自イメージと compose（`db` サービス付き）を置き、`.env` を用意する
   - `DB_PASSWORD` を新しく決める
   - `TUDUDI_SESSION_SECRET` は旧サーバーと同じにする（リカバリーキー・カレンダーフィード・Webhook の復号に必要）
   - `TUDUDI_USER_EMAIL` は旧サーバーの管理者と同じにする（エクスポートした管理者のデータが、この管理者に割り当てられる）
   - SQLite のボリュームは置かない
2. 新しいサーバーで起動し、`Server running on port 3002` が出るまで待つ。この時点では Matrix を設定しない
3. 旧サーバー（v1.15.1）で、管理者アカウントからバックアップをエクスポートする。旧サーバーは止めずに残す
4. 新しいサーバーに管理者でログインし、`/backup` からインポートする
5. Matrix の暗号ストアを移す
   - 両方の Matrix ポーリングを止める（旧サーバーは Matrix タブの Stop、新しいサーバーはコンテナ停止）。同じトークンで2台が同時に動くと、デバイス鍵が食い違う
   - 旧サーバーの `tududi_db/matrix-store/<旧userId>` を、新しいサーバーの `matrix-store/<新userId>` にコピーしてから起動する
   - 新しい ID は管理画面か DB で確認する
6. 確認する
   - Matrix: 保存済みトークンでの Test Connection、テストサマリーの送信、メンションの受信、E2EE の復号、クロス署名の状態
   - 工数・金額の表示、添付ファイル、繰り返しタスク
7. リバースプロキシか DNS で `tududi.gskraft.com` を新しいサーバーに向ける
8. 作り直すもの: API トークン、二段階認証、SSO の紐付け、CalDAV、プッシュ通知（本家の手順書にある一覧のとおり）
9. compose の `backup` サービス（pg_dump）を有効にし、最初のバックアップを取る

### 戻すとき

- 旧サーバーは v1.15.1 のまま残っているので、向き先を戻せば旧環境に戻る
- 戻すときは、新しいサーバーの Matrix を止めてから、旧サーバーの Matrix を Start する
- 新しいサーバーで追加・変更したデータは旧サーバーには戻らない。切り替えの直後は様子を見る期間を短くする
