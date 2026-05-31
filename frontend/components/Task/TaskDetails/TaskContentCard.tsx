import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PencilSquareIcon,
    EyeIcon,
} from '@heroicons/react/24/outline';
import MarkdownRenderer from '../../Shared/MarkdownRenderer';
import MarkdownEditor from '../../Shared/MarkdownEditor';

interface TaskContentCardProps {
    content: string;
    taskUid?: string;
    onUpdate: (
        newContent: string,
        options?: { silent?: boolean }
    ) => Promise<void>;
}

const TaskContentCard: React.FC<TaskContentCardProps> = ({
    content,
    taskUid,
    onUpdate,
}) => {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(content);
    const [contentTab, setContentTab] = useState<'edit' | 'preview'>('edit');
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setEditedContent(content);
    }, [content]);

    useEffect(() => {
        if (isEditing && contentTextareaRef.current) {
            contentTextareaRef.current.focus();
        }
    }, [isEditing]);

    const handleStartEdit = () => {
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (editedContent !== content) {
            await onUpdate(editedContent);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedContent(content);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    return (
        <div className="space-y-2">
            {isEditing ? (
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-blue-500 dark:border-blue-400 p-4">
                    <div className="flex space-x-1 mb-2 justify-end">
                        <button
                            type="button"
                            onClick={() => setContentTab('edit')}
                            className={`p-1.5 rounded-md transition-colors ${
                                contentTab === 'edit'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                            }`}
                            title={t('common.edit', 'Edit')}
                        >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => setContentTab('preview')}
                            className={`p-1.5 rounded-md transition-colors ${
                                contentTab === 'preview'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                            }`}
                            title={t('common.preview', 'Preview')}
                        >
                            <EyeIcon className="h-3 w-3" />
                        </button>
                    </div>

                    {contentTab === 'edit' ? (
                        <MarkdownEditor
                            value={editedContent}
                            onChange={setEditedContent}
                            uploadContext={{ type: 'task', uid: taskUid || null }}
                            minHeight={200}
                            onKeyDown={handleKeyDown}
                        />
                    ) : (
                        <div className="w-full min-h-[200px] bg-gray-50 dark:bg-gray-800 rounded p-3 overflow-y-auto">
                            {editedContent ? (
                                <MarkdownRenderer
                                    content={editedContent}
                                    className="prose dark:prose-invert max-w-none"
                                />
                            ) : (
                                <p className="text-gray-500 dark:text-gray-400 italic">
                                    {t(
                                        'task.noContentPreview',
                                        'No content to preview. Switch to Edit mode to add content.'
                                    )}
                                </p>
                            )}
                        </div>
                    )}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'task.contentEditHint',
                                'Press Cmd/Ctrl+Enter to save, Esc to cancel'
                            )}
                        </span>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                            >
                                {t('common.save', 'Save')}
                            </button>
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : content ? (
                <div
                    onDoubleClick={handleStartEdit}
                    className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
                    title={t(
                        'task.doubleClickToEditContent',
                        'Double-click to edit content'
                    )}
                >
                    <MarkdownRenderer
                        content={content}
                        className="prose dark:prose-invert max-w-none"
                        onContentChange={(newContent) =>
                            onUpdate(newContent, { silent: true })
                        }
                    />
                </div>
            ) : (
                <div
                    onDoubleClick={handleStartEdit}
                    className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
                    title={t(
                        'task.doubleClickToAddContent',
                        'Double-click to add content'
                    )}
                >
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                        <PencilSquareIcon className="h-12 w-12 mb-3 opacity-50" />
                        <span className="text-sm text-center">
                            {t('task.noNotes', 'Add some content')}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskContentCard;
