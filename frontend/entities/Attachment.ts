export interface Attachment {
    id: number;
    uid: string;
    task_id: number;
    user_id: number;
    original_filename: string;
    stored_filename: string;
    file_size: number;
    mime_type: string;
    file_path: string;
    file_url?: string;
    created_at: string;
    updated_at: string;
}

export interface ProjectAttachment {
    id: number;
    uid: string;
    project_id: number;
    user_id: number;
    original_filename: string;
    stored_filename: string;
    file_size: number;
    mime_type: string;
    file_path: string;
    file_url?: string;
    created_at: string;
    updated_at: string;
}

export interface NoteAttachment {
    id: number;
    uid: string;
    note_id: number;
    user_id: number;
    original_filename: string;
    stored_filename: string;
    file_size: number;
    mime_type: string;
    file_path: string;
    file_url?: string;
    created_at: string;
    updated_at: string;
}

export type AttachmentType =
    | 'image'
    | 'pdf'
    | 'text'
    | 'document'
    | 'spreadsheet'
    | 'archive'
    | 'other';
