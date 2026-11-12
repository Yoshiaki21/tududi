import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

// Matrix bot のクロス署名（デバイスのセルフ検証）。リカバリーキーはサーバーで
// 暗号化して保存され、ブラウザには「設定済みかどうか」しか返らない。

export interface CrossSigningStatus {
    running: boolean;
    recoveryKeySet: boolean;
    deviceVerified: boolean | null;
    recoveryAvailable: boolean | null;
    lastResult: { state: string; message: string | null; at: string } | null;
}

const readError = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => ({}));
    return data.error || data.message || fallback;
};

async function send<T>(
    path: string,
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    fallbackError: string,
    body?: unknown
): Promise<T> {
    const headers: Record<string, string> = {};
    if (method !== 'GET') headers['x-csrf-token'] = await getCsrfToken();
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(getApiPath(path), {
        method,
        credentials: 'include',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(await readError(response, fallbackError));
    }
    return response.json();
}

export const getCrossSigningStatus = () =>
    send<CrossSigningStatus>(
        'matrix/cross-signing',
        'GET',
        'Could not load the cross-signing status'
    );

export const saveRecoveryKey = (recoveryKey: string) =>
    send<CrossSigningStatus>(
        'matrix/recovery-key',
        'PUT',
        'Could not save the recovery key',
        { recovery_key: recoveryKey }
    );

export const removeRecoveryKey = () =>
    send<CrossSigningStatus>(
        'matrix/recovery-key',
        'DELETE',
        'Could not remove the recovery key'
    );

export const verifyMatrixDevice = () =>
    send<CrossSigningStatus>(
        'matrix/cross-signing/verify',
        'POST',
        'Could not verify the device'
    );

export const createMatrixIdentity = () =>
    send<{ recovery_key: string; status: CrossSigningStatus }>(
        'matrix/cross-signing/create',
        'POST',
        'Could not set up cross-signing'
    );
