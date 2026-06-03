import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    PencilSquareIcon,
    TrashIcon,
    TagIcon,
    FolderIcon,
} from '@heroicons/react/24/solid';
import { DocumentDuplicateIcon, PaperClipIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import ConfirmDialog from '../Shared/ConfirmDialog';
import NoteModal from './NoteModal';
import MarkdownRenderer from '../Shared/MarkdownRenderer';
import { Note } from '../../entities/Note';
import {
    fetchNoteBySlug,
    updateNote as apiUpdateNote,
} from '../../utils/notesService';
import { deleteNoteWithStoreUpdate } from '../../utils/noteDeleteUtils';
import { createProject } from '../../utils/projectsService';
import { useStore } from '../../store/useStore';
import { NoteAttachment } from '../../entities/Attachment';
import {
    fetchNoteAttachments,
    uploadNoteAttachment,
    deleteNoteAttachment,
    getAttachmentType,
} from '../../utils/noteAttachmentsService';
import AttachmentPreview from '../Shared/AttachmentPreview';

const NoteDetails: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast } = useToast();
    const { uidSlug } = useParams<{ uidSlug: string }>();
    const [note, setNote] = useState<Note | null>(null);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] =
        useState<boolean>(false);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const projects = useStore((state: any) => state.projectsStore.projects);
    const { setProjects } = useStore((state: any) => state.projectsStore);
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'text' | 'attachments'>('text');
    const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<NoteAttachment | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchNote = async () => {
            try {
                setIsLoading(true);
                const foundNote = await fetchNoteBySlug(uidSlug!);
                setNote(foundNote || null);
                if (!foundNote) {
                    setIsError(true);
                }
            } catch (err) {
                setIsError(true);
                console.error('Error fetching note:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchNote();
    }, [uidSlug]);

    useEffect(() => {
        if (activeTab === 'attachments' && note?.uid) {
            setAttachmentsLoading(true);
            fetchNoteAttachments(note.uid)
                .then(setAttachments)
                .catch(console.error)
                .finally(() => setAttachmentsLoading(false));
        }
    }, [activeTab, note?.uid]);

    const handleDeleteNote = async () => {
        if (!noteToDelete) return;
        try {
            await deleteNoteWithStoreUpdate(noteToDelete, showSuccessToast, t);
            navigate('/notes');
        } catch (err) {
            console.error('Error deleting note:', err);
        }
    };

    const handleSaveNote = async (updatedNote: Note) => {
        try {
            const noteIdentifier =
                updatedNote.uid ??
                (updatedNote.id !== undefined ? String(updatedNote.id) : null);

            if (noteIdentifier) {
                const savedNote = await apiUpdateNote(
                    noteIdentifier,
                    updatedNote
                );
                setNote(savedNote);
            } else {
                console.error('Error: Note identifier is undefined.');
            }
        } catch (err) {
            console.error('Error saving note:', err);
        }
        setIsNoteModalOpen(false);
    };

    const handleEditNote = () => {
        setIsNoteModalOpen(true);
    };

    const handleCopyNote = async () => {
        if (!note) return;
        try {
            await navigator.clipboard.writeText(note.content);
            showSuccessToast(t('notes.copiedToClipboard', 'Note content copied to clipboard'));
        } catch (err) {
            console.error('Error copying to clipboard:', err);
        }
    };

    const handleCreateProject = async (name: string) => {
        try {
            const newProject = await createProject({
                name,
                priority: 'low',
            });
            setProjects([...projects, newProject]);
            return newProject;
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    };

    const handleOpenConfirmDialog = (note: Note) => {
        setNoteToDelete(note);
        setIsConfirmDialogOpen(true);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !note?.uid) return;
        setUploading(true);
        try {
            const newAtt = await uploadNoteAttachment(note.uid, file);
            setAttachments((prev) => [...prev, newAtt]);
        } catch (err) {
            console.error('Error uploading note attachment:', err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAttachmentDelete = async (att: NoteAttachment) => {
        if (!note?.uid) return;
        try {
            await deleteNoteAttachment(note.uid, att.uid);
            setAttachments((prev) => prev.filter((a) => a.uid !== att.uid));
            if (previewAttachment?.uid === att.uid) setPreviewAttachment(null);
        } catch (err) {
            console.error('Error deleting note attachment:', err);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    Loading note details...
                </div>
            </div>
        );
    }

    if (isError || !note) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">
                    {isError
                        ? 'Error loading note details.'
                        : 'Note not found.'}
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                {/* Header Section with Title and Action Buttons */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100">
                                {note.title}
                            </h2>
                            {/* Project and Tags under title */}
                            {(note.project ||
                                note.Project ||
                                (note.tags && note.tags.length > 0) ||
                                (note.Tags && note.Tags.length > 0)) && (
                                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {(note.project || note.Project) && (
                                        <div className="flex items-center">
                                            <FolderIcon className="h-3 w-3 mr-1" />
                                            <Link
                                                to={
                                                    (
                                                        note.project ||
                                                        note.Project
                                                    )?.uid
                                                        ? `/project/${(note.project || note.Project)?.uid}-${(
                                                              note.project ||
                                                              note.Project
                                                          )?.name
                                                              .toLowerCase()
                                                              .replace(
                                                                  /[^a-z0-9]+/g,
                                                                  '-'
                                                              )
                                                              .replace(
                                                                  /^-|-$/g,
                                                                  ''
                                                              )}`
                                                        : `/project/${(note.project || note.Project)?.id}`
                                                }
                                                className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                                            >
                                                {
                                                    (
                                                        note.project ||
                                                        note.Project
                                                    )?.name
                                                }
                                            </Link>
                                        </div>
                                    )}
                                    {(note.project || note.Project) &&
                                        ((note.tags && note.tags.length > 0) ||
                                            (note.Tags &&
                                                note.Tags.length > 0)) && (
                                            <span className="mx-2">•</span>
                                        )}
                                    {((note.tags && note.tags.length > 0) ||
                                        (note.Tags &&
                                            note.Tags.length > 0)) && (
                                        <div className="flex items-center">
                                            <TagIcon className="h-3 w-3 mr-1" />
                                            <span>
                                                {(note.tags || note.Tags || [])
                                                    .map((tag) => tag.name)
                                                    .join(', ')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                        <button
                            onClick={handleCopyNote}
                            className="text-gray-500 hover:text-green-700 dark:hover:text-green-300 focus:outline-none"
                            aria-label={t('notes.copyContent', 'Copy note content')}
                            title={t('notes.copyContent', 'Copy note content')}
                        >
                            <DocumentDuplicateIcon className="h-5 w-5" />
                        </button>
                        <button
                            onClick={handleEditNote}
                            className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
                            aria-label={`Edit ${note.title}`}
                            title={`Edit ${note.title}`}
                        >
                            <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => handleOpenConfirmDialog(note)}
                            className="text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none"
                            aria-label={`Delete ${note.title}`}
                            title={`Delete ${note.title}`}
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-4 mb-4 border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setActiveTab('text')}
                        className={`pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            activeTab === 'text'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        {t('notes.textTab', 'テキスト')}
                    </button>
                    <button
                        onClick={() => setActiveTab('attachments')}
                        className={`pb-2 text-sm font-medium flex items-center space-x-1 transition-colors border-b-2 -mb-px ${
                            activeTab === 'attachments'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <PaperClipIcon className="h-4 w-4" />
                        <span>{t('notes.attachmentsTab', '添付ファイル')}</span>
                        {attachments.length > 0 && (
                            <span className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded-full">
                                {attachments.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Text Tab */}
                {activeTab === 'text' && (
                    <div
                        className="mb-6 bg-white dark:bg-gray-900 shadow-md rounded-lg p-6 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors cursor-pointer"
                        onDoubleClick={handleEditNote}
                        title="ダブルクリックして編集"
                    >
                        <MarkdownRenderer
                            content={note.content}
                            onContentChange={async (newContent) => {
                                const updatedNote = {
                                    ...note,
                                    content: newContent,
                                };
                                setNote(updatedNote);

                                try {
                                    const noteIdentifier =
                                        note.uid ??
                                        (note.id !== undefined
                                            ? String(note.id)
                                            : null);

                                    if (noteIdentifier) {
                                        await apiUpdateNote(
                                            noteIdentifier,
                                            updatedNote
                                        );
                                    }
                                } catch (err) {
                                    console.error(
                                        'Error auto-saving checkbox:',
                                        err
                                    );
                                }
                            }}
                        />
                    </div>
                )}

                {/* Attachments Tab */}
                {activeTab === 'attachments' && (
                    <div className="mb-6">
                        {attachmentsLoading ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading', 'Loading...')}</p>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {/* Upload card */}
                                    <div
                                        className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
                                        style={{ minHeight: '250px', maxHeight: '250px' }}
                                        onClick={() => !uploading && fileInputRef.current?.click()}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                            disabled={uploading}
                                            accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.gif,.svg,.webp,.xls,.xlsx,.csv,.zip"
                                        />
                                        <div
                                            className="bg-gray-200 dark:bg-gray-700 flex flex-col items-center justify-center rounded-t-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                                            style={{ height: '140px' }}
                                        >
                                            <CloudArrowUpIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-2" />
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {uploading
                                                    ? t('task.attachments.uploading', 'Uploading...')
                                                    : t('task.attachments.clickToUpload', 'Click to upload')}
                                            </p>
                                        </div>
                                        <div className="p-4 flex-1 flex flex-col justify-center">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                                {t('task.attachments.maxSize', 'Max 10MB')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Attachment cards */}
                                    {attachments.map((att) => (
                                        <div
                                            key={att.uid}
                                            className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-col"
                                            style={{ minHeight: '250px', maxHeight: '250px' }}
                                        >
                                            <div
                                                className="bg-gray-200 dark:bg-gray-700 flex items-center justify-center rounded-t-lg cursor-pointer overflow-hidden"
                                                style={{ height: '140px' }}
                                                onClick={() => setPreviewAttachment(previewAttachment?.uid === att.uid ? null : att)}
                                            >
                                                {getAttachmentType(att.mime_type) === 'image' && att.file_url ? (
                                                    <img src={att.file_url} alt={att.original_filename} className="w-full h-full object-cover" />
                                                ) : (
                                                    <PaperClipIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                                                )}
                                            </div>
                                            <div className="p-3 flex-1 flex flex-col justify-between">
                                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{att.original_filename}</p>
                                                <button
                                                    onClick={() => handleAttachmentDelete(att)}
                                                    className="text-xs text-red-500 hover:text-red-700 mt-2"
                                                >
                                                    {t('common.delete', 'Delete')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Preview modal */}
                                {previewAttachment && (
                                    <div
                                        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
                                        onClick={() => setPreviewAttachment(null)}
                                    >
                                        <div
                                            className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-[90vh] overflow-auto"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{previewAttachment.original_filename}</h3>
                                                <button onClick={() => setPreviewAttachment(null)} className="text-gray-500 hover:text-gray-700">✕</button>
                                            </div>
                                            <div className="p-1">
                                                <AttachmentPreview attachment={previewAttachment as any} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* NoteModal for editing */}
                {isNoteModalOpen && (
                    <NoteModal
                        isOpen={isNoteModalOpen}
                        onClose={() => setIsNoteModalOpen(false)}
                        onSave={handleSaveNote}
                        onDelete={async (noteUid) => {
                            try {
                                await deleteNoteWithStoreUpdate(
                                    noteUid,
                                    showSuccessToast,
                                    t
                                );
                                navigate('/notes');
                            } catch (err) {
                                console.error('Error deleting note:', err);
                            }
                        }}
                        note={note}
                        projects={projects}
                        onCreateProject={handleCreateProject}
                    />
                )}
                {/* ConfirmDialog */}
                {isConfirmDialogOpen && noteToDelete && (
                    <ConfirmDialog
                        title="Delete Note"
                        message={`Are you sure you want to delete the note "${noteToDelete.title}"?`}
                        onConfirm={handleDeleteNote}
                        onCancel={() => {
                            setIsConfirmDialogOpen(false);
                            setNoteToDelete(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default NoteDetails;
