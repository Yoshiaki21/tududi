# tududi 改修作業指示書

<!-- 未着手・進行中のタスクをここに記載する -->
<!-- 完了したタスクは tududi_tasks_done.md に移動すること -->

## tududi 追加実装指示書 PR#1〜#4

---

## PR#1: プロジェクト一覧への作業時間・金額表示

### 概要
プロジェクトカードに、そのプロジェクトに紐づくタスクの合計作業時間と合計金額を表示する。

### 表示仕様
- 表示位置: プロジェクトカードの期限表示の直下
- 表示形式: `10.0h  ¥31,250`
- 非表示条件: 作業時間が0または未入力、かつ金額が0の場合は表示しない（どちらか一方が0でも、もう一方が0でなければ表示する）

### バックエンド実装

**1. プロジェクト一覧APIの拡張 (`app/controllers/api/projects_controller.rb`)**

`index` アクションで返すプロジェクトデータに、以下の集計値を追加する。

```ruby
# 各プロジェクトに対して以下を計算して返す
total_hours: project.tasks.sum(:actual_hours).to_f.round(1)  # 実績工数の合計
total_amount: project.tasks.sum(:amount).to_i                 # 金額の合計
```

※ `actual_hours` および `amount` カラムは工数管理機能（タスク10）で追加済みであることを前提とする。
※ プロジェクト単体取得API (`show`) にも同様に追加する。

### フロントエンド実装

**1. プロジェクト型定義の拡張 (`app/javascript/types/index.ts` または該当する型定義ファイル)**

```typescript
// Project 型に以下を追加
totalHours?: number;
totalAmount?: number;
```

**2. プロジェクトカードコンポーネントの修正**

該当コンポーネント（`ProjectCard.tsx` または `ProjectItem.tsx` 等、プロジェクト一覧のカード表示を担うファイル）を修正する。

期限表示の直下に以下のロジックで表示を追加する:

```tsx
{/* 作業時間・金額表示 */}
{(project.totalHours > 0 || project.totalAmount > 0) && (
  <div className="project-work-summary">
    {project.totalHours > 0 && (
      <span className="work-hours">{project.totalHours.toFixed(1)}h</span>
    )}
    {project.totalAmount > 0 && (
      <span className="work-amount">
        ¥{project.totalAmount.toLocaleString('ja-JP')}
      </span>
    )}
  </div>
)}
```

**3. スタイリング**

既存の期限表示と同様のフォントサイズ・色調（グレー系）で表示する。`work-hours` と `work-amount` の間には適度なスペース（`gap` または `margin`）を設ける。

---

## PR#2: プロジェクト添付ファイル機能

### 概要
タスクの添付ファイル機能と同等の実装をプロジェクトに追加する。

### アップロードパス
`projects/project-{id}.jpg`（例: `projects/project-123.png`）

### バックエンド実装

**1. マイグレーション追加**

```ruby
# db/migrate/YYYYMMDDHHMMSS_create_project_attachments.rb
class CreateProjectAttachments < ActiveRecord::Migration[7.0]
  def change
    create_table :project_attachments do |t|
      t.references :project, null: false, foreign_key: true
      t.string :filename, null: false
      t.string :content_type
      t.integer :file_size
      t.string :storage_path, null: false
      t.timestamps
    end
  end
end
```

**2. モデル追加 (`app/models/project_attachment.rb`)**

タスク添付ファイルのモデル（`TaskAttachment` 等）を参考に作成する。

```ruby
class ProjectAttachment < ApplicationRecord
  belongs_to :project
  # バリデーション・ファイル取得メソッド等はTaskAttachmentと同様に実装
end
```

**3. Projectモデルへのアソシエーション追加 (`app/models/project.rb`)**

```ruby
has_many :project_attachments, dependent: :destroy
```

**4. APIコントローラー追加 (`app/controllers/api/project_attachments_controller.rb`)**

`TaskAttachmentsController` を参考に以下のアクションを実装する:
- `index`: プロジェクトの添付ファイル一覧取得
- `create`: ファイルアップロード（保存パス: `public/uploads/projects/project-{id}.{ext}`）
- `destroy`: 添付ファイル削除

**5. ルーティング追加 (`config/routes.rb`)**

```ruby
# 既存の tasks の添付ファイルルーティングを参考に追加
namespace :api do
  resources :projects do
    resources :project_attachments, only: [:index, :create, :destroy]
  end
end
```

### フロントエンド実装

**1. プロジェクト詳細画面へのタブ追加**

プロジェクト詳細画面（`ProjectDetail.tsx` または該当ファイル）を修正し、添付ファイルタブを追加する。

- タブ構成: `概要` / `タスク` / `添付ファイル`（既存タブ構成に合わせて追加）
- 添付ファイルタブの内容: タスク詳細の添付ファイルタブと同等のUI（ファイル一覧・アップロードボタン）

**2. 型定義追加**

```typescript
interface ProjectAttachment {
  id: number;
  filename: string;
  contentType: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
}
```

**3. APIクライアント追加**

タスク添付ファイル用のAPIクライアント関数を参考に、プロジェクト添付ファイル用の関数を追加する:
- `fetchProjectAttachments(projectId)`
- `uploadProjectAttachment(projectId, file)`
- `deleteProjectAttachment(projectId, attachmentId)`

---

## PR#3: 共通MarkdownEditorコンポーネント（ツールバー＋画像D&D）

### 概要
Markdownエディタを共通コンポーネントとして新規作成し、タスク概要欄・プロジェクト概要欄・ノートに適用する。

### 画像URLの形式
`https://tududi.gskraft.com/api/uploads/tasks/task-xxx.jpg`（確認済み）
※ ノートの場合は `notes/note-xxx.jpg`、プロジェクトは `projects/project-xxx.jpg`

### コンポーネント仕様

**ファイル: `app/javascript/components/shared/MarkdownEditor.tsx`**（新規作成）

#### Props

```typescript
interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  uploadContext: {
    type: 'task' | 'project' | 'note';
    id: number | null;  // 新規作成時はnull（D&D無効化）
  };
  placeholder?: string;
  minHeight?: number;  // px単位、デフォルト: 200
}
```

#### ツールバーボタン一覧

| ボタン | 挿入テキスト / 動作 |
|--------|-------------------|
| 太字 | `**テキスト**` |
| 斜体 | `*テキスト*` |
| 見出し | `## テキスト` |
| リスト | `- テキスト` |
| チェックボックス | `- [ ] テキスト` |
| コード | `` `コード` ``（複数行選択時は ` ```\nコード\n``` `）|
| 区切り線 | `\n---\n` |
| リンク | `[テキスト](URL)` |

選択テキストがある場合は選択範囲をラップし、ない場合はカーソル位置に挿入する。

#### 画像ドラッグ&ドロップ仕様

1. テキストエリア上への画像ファイルのドロップを検知する
2. `uploadContext.id` が `null` の場合はD&Dを無効とし、「保存後にアップロードできます」等のメッセージを表示する
3. `uploadContext.id` が存在する場合:
   - 既存の添付ファイルアップロードAPIを呼び出す
     - task: `POST /api/tasks/{id}/task_attachments`
     - project: `POST /api/projects/{id}/project_attachments`
     - note: `POST /api/notes/{id}/note_attachments`
   - アップロード成功後、カーソル位置に `![ファイル名](URL)` を自動挿入
   - URL形式: `https://tududi.gskraft.com/api/uploads/{type}s/{type}-{id}.{ext}`
4. アップロード中はスピナー表示またはオーバーレイで進捗を示す

#### UIレイアウト

```
┌─────────────────────────────────────────────────┐
│ [B] [I] [H] [List] [☑] [<>] [---] [🔗]         │  ← ツールバー
├─────────────────────────────────────────────────┤
│                                                 │
│  テキストエリア（画像D&D対応）                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 適用箇所

以下の3箇所で既存のテキストエリアを `MarkdownEditor` に置き換える:

1. **タスク概要欄**: タスク詳細・編集フォームの概要（description）入力欄
   - `uploadContext`: `{ type: 'task', id: task.id }`
2. **プロジェクト概要欄**: プロジェクト詳細・編集フォームの概要入力欄
   - `uploadContext`: `{ type: 'project', id: project.id }`
3. **ノート**: PR#4で実装するノートのテキストタブ
   - `uploadContext`: `{ type: 'note', id: note.id }`

---

## PR#4: ノートに添付ファイルタブ追加

### 概要
現在プレーンテキストエリアのみのノート画面を、「テキスト」「添付ファイル」の2タブ構成に変更する。テキストタブにはPR#3の共通MarkdownEditorを適用する。

### バックエンド実装

**1. マイグレーション追加**

```ruby
# db/migrate/YYYYMMDDHHMMSS_create_note_attachments.rb
class CreateNoteAttachments < ActiveRecord::Migration[7.0]
  def change
    create_table :note_attachments do |t|
      t.references :note, null: false, foreign_key: true
      t.string :filename, null: false
      t.string :content_type
      t.integer :file_size
      t.string :storage_path, null: false
      t.timestamps
    end
  end
end
```

**2. モデル追加 (`app/models/note_attachment.rb`)**

`TaskAttachment` を参考に作成する。

```ruby
class NoteAttachment < ApplicationRecord
  belongs_to :note
  # バリデーション・ファイル取得メソッド等はTaskAttachmentと同様に実装
end
```

**3. Noteモデルへのアソシエーション追加 (`app/models/note.rb`)**

```ruby
has_many :note_attachments, dependent: :destroy
```

**4. APIコントローラー追加 (`app/controllers/api/note_attachments_controller.rb`)**

`TaskAttachmentsController` を参考に以下のアクションを実装する:
- `index`: ノートの添付ファイル一覧取得
- `create`: ファイルアップロード（保存パス: `public/uploads/notes/note-{id}.{ext}`）
- `destroy`: 添付ファイル削除

**5. ルーティング追加 (`config/routes.rb`)**

```ruby
namespace :api do
  resources :notes do
    resources :note_attachments, only: [:index, :create, :destroy]
  end
end
```

### フロントエンド実装

**1. ノート画面のタブ構成変更**

ノート詳細・編集画面（`NoteDetail.tsx` または該当ファイル）を以下の2タブ構成に変更する:

- **テキストタブ**: PR#3の `MarkdownEditor` コンポーネントを適用
  - `uploadContext`: `{ type: 'note', id: note.id }`
  - 既存のプレーンテキストエリアと置き換える
- **添付ファイルタブ**: タスク詳細の添付ファイルタブと同等のUI
  - ファイル一覧（ファイル名・サイズ・削除ボタン）
  - アップロードボタン（ファイル選択ダイアログ）

**2. 型定義追加**

```typescript
interface NoteAttachment {
  id: number;
  filename: string;
  contentType: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
}
```

**3. APIクライアント追加**

タスク添付ファイル用のAPIクライアント関数を参考に、ノート添付ファイル用の関数を追加する:
- `fetchNoteAttachments(noteId)`
- `uploadNoteAttachment(noteId, file)`
- `deleteNoteAttachment(noteId, attachmentId)`

### 注意事項

- 既存ノートデータへの影響なし（テキスト内容は既存カラムをそのまま使用）
- Markdownレンダリングについて: テキスト表示時（閲覧モード）はMarkdownをHTMLとしてレンダリングする。既存のMarkdownレンダリングライブラリ（`marked` / `react-markdown` 等、プロジェクトで使用中のもの）を流用すること

---

## 実装順序の推奨

依存関係を考慮し、以下の順で実装することを推奨する:

1. **PR#3**（MarkdownEditorコンポーネント）: 他のPRに依存なし、先行実装する
2. **PR#2**（プロジェクト添付ファイル）: バックエンド先行、フロントはPR#3完了後
3. **PR#4**（ノート添付ファイル＋MarkdownEditor適用）: PR#3完了後に実装
4. **PR#1**（プロジェクト一覧への工数表示）: 他のPRに依存なし、任意のタイミングで実装可

---

## Claude Codeへの指示

```
tududi_tasks.md のPR#1〜#4を順番に実装してください。
実装順序はPR#3 → PR#2 → PR#4 → PR#1 を推奨します。
各PRの実装完了後にコミットしてください。
```
 

