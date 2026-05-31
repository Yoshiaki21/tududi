import { NoteAttachment } from '../entities/Attachment';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';
import { getAttachmentType } from './attachmentsService';

export async function fetchNoteAttachments(
    noteUid: string
): Promise<NoteAttachment[]> {
    const response = await fetch(getApiPath(`note/${noteUid}/attachments`), {
        method: 'GET',
        credentials: 'include',
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch note attachments');
    }
    return await response.json();
}

export async function uploadNoteAttachment(
    noteUid: string,
    file: File
): Promise<NoteAttachment> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(getApiPath(`note/${noteUid}/attachments`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': await getCsrfToken() },
        body: formData,
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to upload note attachment');
    }
    return await response.json();
}

export async function deleteNoteAttachment(
    noteUid: string,
    attachmentUid: string
): Promise<void> {
    const response = await fetch(
        getApiPath(`note/${noteUid}/attachments/${attachmentUid}`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'x-csrf-token': await getCsrfToken() },
        }
    );
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete note attachment');
    }
}

export { getAttachmentType };
