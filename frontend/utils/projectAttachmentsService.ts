import { ProjectAttachment } from '../entities/Attachment';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';
import { getAttachmentType } from './attachmentsService';

export async function fetchProjectAttachments(
    projectUid: string
): Promise<ProjectAttachment[]> {
    const response = await fetch(getApiPath(`project/${projectUid}/attachments`), {
        method: 'GET',
        credentials: 'include',
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch project attachments');
    }
    return await response.json();
}

export async function uploadProjectAttachment(
    projectUid: string,
    file: File
): Promise<ProjectAttachment> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(getApiPath(`project/${projectUid}/attachments`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': await getCsrfToken() },
        body: formData,
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to upload project attachment');
    }
    return await response.json();
}

export async function deleteProjectAttachment(
    projectUid: string,
    attachmentUid: string
): Promise<void> {
    const response = await fetch(
        getApiPath(`project/${projectUid}/attachments/${attachmentUid}`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'x-csrf-token': await getCsrfToken() },
        }
    );
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete project attachment');
    }
}

export { getAttachmentType };
