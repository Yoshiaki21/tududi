import React, { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getCsrfToken } from '../../utils/csrfService';
import { getApiPath } from '../../config/paths';

export interface UploadContext {
    type: 'task' | 'project' | 'note';
    uid: string | null;
}

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    uploadContext: UploadContext;
    placeholder?: string;
    minHeight?: number;
    className?: string;
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

async function uploadImageForContext(
    context: UploadContext,
    file: File
): Promise<string | null> {
    if (!context.uid) return null;

    const formData = new FormData();
    formData.append('file', file);

    let url: string;
    if (context.type === 'task') {
        formData.append('taskUid', context.uid);
        url = getApiPath('upload/task-attachment');
    } else if (context.type === 'project') {
        url = getApiPath(`project/${context.uid}/attachments`);
    } else {
        url = getApiPath(`note/${context.uid}/attachments`);
    }

    const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': await getCsrfToken() },
        body: formData,
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.file_url || null;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
    value,
    onChange,
    uploadContext,
    placeholder,
    minHeight = 200,
    className = '',
    onKeyDown,
}) => {
    const { t } = useTranslation();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const insertWrap = useCallback(
        (before: string, after: string, defaultText: string) => {
            const ta = textareaRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const selected = value.substring(start, end) || defaultText;
            const newValue =
                value.substring(0, start) +
                before +
                selected +
                after +
                value.substring(end);
            onChange(newValue);
            setTimeout(() => {
                ta.focus();
                const newEnd = start + before.length + selected.length + after.length;
                ta.setSelectionRange(newEnd, newEnd);
            }, 0);
        },
        [value, onChange]
    );

    const insertPrefix = useCallback(
        (prefix: string, defaultText: string) => {
            const ta = textareaRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const newValue =
                value.substring(0, lineStart) +
                prefix +
                defaultText +
                value.substring(start);
            onChange(newValue);
            setTimeout(() => {
                ta.focus();
                const pos = lineStart + prefix.length + defaultText.length;
                ta.setSelectionRange(pos, pos);
            }, 0);
        },
        [value, onChange]
    );

    const insertBlock = useCallback(
        (block: string) => {
            const ta = textareaRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const newValue =
                value.substring(0, start) + block + value.substring(start);
            onChange(newValue);
            setTimeout(() => {
                ta.focus();
                const pos = start + block.length;
                ta.setSelectionRange(pos, pos);
            }, 0);
        },
        [value, onChange]
    );

    const handleBold = () => insertWrap('**', '**', 'テキスト');
    const handleItalic = () => insertWrap('*', '*', 'テキスト');
    const handleHeading = () => insertPrefix('## ', 'テキスト');
    const handleList = () => insertPrefix('- ', 'テキスト');
    const handleCheckbox = () => insertPrefix('- [ ] ', 'テキスト');
    const handleCode = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const selected = value.substring(ta.selectionStart, ta.selectionEnd);
        if (selected.includes('\n')) {
            insertWrap('```\n', '\n```', 'コード');
        } else {
            insertWrap('`', '`', 'コード');
        }
    };
    const handleHR = () => insertBlock('\n---\n');
    const handleLink = () => insertWrap('[', '](URL)', 'テキスト');

    const generatePasteFilename = (mimeType: string): string => {
        const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
        const now = new Date();
        const ts =
            now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            '-' +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
        return `paste-${ts}.${ext}`;
    };

    const isGenericFilename = (name: string): boolean => {
        return !name || /^image\.(png|jpe?g|gif|webp|svg)$/i.test(name);
    };

    const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        if (!uploadContext.uid) return;

        const imageItems = Array.from(e.clipboardData.items).filter((item) =>
            item.type.startsWith('image/')
        );
        if (imageItems.length === 0) return;

        e.preventDefault();
        setIsUploading(true);
        try {
            const ta = textareaRef.current;
            let insertPos = ta ? ta.selectionStart : value.length;
            let updatedValue = value;

            for (const item of imageItems) {
                const raw = item.getAsFile();
                if (!raw) continue;
                const file = isGenericFilename(raw.name)
                    ? new File([raw], generatePasteFilename(raw.type), { type: raw.type })
                    : raw;
                const fileUrl = await uploadImageForContext(uploadContext, file);
                if (fileUrl) {
                    const md = `![${file.name}](${fileUrl})\n`;
                    updatedValue =
                        updatedValue.substring(0, insertPos) +
                        md +
                        updatedValue.substring(insertPos);
                    insertPos += md.length;
                }
            }

            onChange(updatedValue);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('Files')) {
            setIsDragOver(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragOver(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        if (!uploadContext.uid) {
            return;
        }

        const imageFiles = Array.from(e.dataTransfer.files).filter((f) =>
            f.type.startsWith('image/')
        );
        if (imageFiles.length === 0) return;

        setIsUploading(true);
        try {
            const ta = textareaRef.current;
            let insertPos = ta ? ta.selectionStart : value.length;
            let updatedValue = value;

            for (const file of imageFiles) {
                const fileUrl = await uploadImageForContext(uploadContext, file);
                if (fileUrl) {
                    const md = `![${file.name}](${fileUrl})\n`;
                    updatedValue =
                        updatedValue.substring(0, insertPos) +
                        md +
                        updatedValue.substring(insertPos);
                    insertPos += md.length;
                }
            }

            onChange(updatedValue);
        } finally {
            setIsUploading(false);
        }
    };

    const toolbarBtn =
        'px-2 py-1 text-xs font-mono rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors';

    return (
        <div className={`flex flex-col ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center flex-wrap gap-0.5 px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-t-md">
                <button type="button" onClick={handleBold} className={toolbarBtn} title={t('editor.bold', '太字')}>
                    <strong>B</strong>
                </button>
                <button type="button" onClick={handleItalic} className={toolbarBtn} title={t('editor.italic', '斜体')}>
                    <em>I</em>
                </button>
                <button type="button" onClick={handleHeading} className={toolbarBtn} title={t('editor.heading', '見出し')}>
                    H
                </button>
                <span className="w-px h-4 bg-gray-300 dark:bg-gray-500 mx-0.5" />
                <button type="button" onClick={handleList} className={toolbarBtn} title={t('editor.list', 'リスト')}>
                    ≡
                </button>
                <button type="button" onClick={handleCheckbox} className={toolbarBtn} title={t('editor.checkbox', 'チェックボックス')}>
                    ☑
                </button>
                <span className="w-px h-4 bg-gray-300 dark:bg-gray-500 mx-0.5" />
                <button type="button" onClick={handleCode} className={toolbarBtn} title={t('editor.code', 'コード')}>
                    {'<>'}
                </button>
                <button type="button" onClick={handleHR} className={toolbarBtn} title={t('editor.hr', '区切り線')}>
                    —
                </button>
                <button type="button" onClick={handleLink} className={toolbarBtn} title={t('editor.link', 'リンク')}>
                    🔗
                </button>
            </div>

            {/* Textarea with drag overlay */}
            <div
                className="relative flex-1"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {isDragOver && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-50 dark:bg-blue-900/30 border-2 border-dashed border-blue-400 rounded-b-md">
                        <p className="text-sm text-blue-600 dark:text-blue-300 font-medium">
                            {t('editor.dropImage', '画像をドロップしてアップロード')}
                        </p>
                    </div>
                )}
                {isUploading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50/80 dark:bg-gray-900/80 rounded-b-md">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            {t('editor.uploading', 'アップロード中...')}
                        </p>
                    </div>
                )}
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    onPaste={handlePaste}
                    placeholder={
                        placeholder ||
                        (uploadContext.uid
                            ? t('editor.placeholder', 'Markdownで入力... 画像はドラッグ＆ドロップまたは貼り付け可')
                            : t('editor.placeholderNoUpload', 'Markdownで入力...'))
                    }
                    className="w-full border border-gray-300 dark:border-gray-600 border-t-0 rounded-b-md px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                    style={{ minHeight: `${minHeight}px` }}
                />
            </div>
        </div>
    );
};

export default MarkdownEditor;
