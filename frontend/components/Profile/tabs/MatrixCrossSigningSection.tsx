import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    InformationCircleIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../../Shared/ToastContext';
import {
    type CrossSigningStatus,
    createMatrixIdentity,
    getCrossSigningStatus,
    removeRecoveryKey,
    saveRecoveryKey,
    verifyMatrixDevice,
} from '../../../utils/matrixCrossSigningService';

interface MatrixCrossSigningSectionProps {
    // Matrix の基本設定が済んでいるか
    configured: boolean;
    // 受信（クライアント）が動いているか。変わったら状態を読み直す
    isPolling: boolean;
}

const inputClass =
    'mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100';
const buttonClass =
    'px-3 py-1.5 rounded-md text-sm disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 disabled:cursor-not-allowed';

// Bot デバイスのクロス署名（Element の「所有者が検証していないデバイス」警告の解消）
const MatrixCrossSigningSection: React.FC<MatrixCrossSigningSectionProps> = ({
    configured,
    isPolling,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [status, setStatus] = useState<CrossSigningStatus | null>(null);
    const [recoveryKey, setRecoveryKey] = useState('');
    const [busy, setBusy] = useState(false);
    const [createdKey, setCreatedKey] = useState<string | null>(null);

    const loadStatus = useCallback(async () => {
        try {
            setStatus(await getCrossSigningStatus());
        } catch {
            setStatus(null);
        }
    }, []);

    useEffect(() => {
        if (!configured) return;
        void loadStatus();
        if (!isPolling) return;
        // 起動直後の自動検証はバックグラウンドで走るので、少し待って読み直す
        const timer = setTimeout(() => void loadStatus(), 4000);
        return () => clearTimeout(timer);
    }, [configured, isPolling, loadStatus]);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        try {
            await action();
        } catch (error) {
            showErrorToast((error as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const handleSaveKey = () =>
        run(async () => {
            const next = await saveRecoveryKey(recoveryKey);
            setStatus(next);
            setRecoveryKey('');
            showSuccessToast(
                t('profile.matrix.crossSigning.keySaved', 'Recovery key saved.')
            );
        });

    const handleDeleteKey = () =>
        run(async () => {
            setStatus(await removeRecoveryKey());
            showSuccessToast(
                t(
                    'profile.matrix.crossSigning.keyDeleted',
                    'Recovery key removed.'
                )
            );
        });

    const handleVerify = () =>
        run(async () => {
            setStatus(await verifyMatrixDevice());
        });

    const handleCreate = () => {
        const ok = window.confirm(
            t(
                'profile.matrix.crossSigning.createConfirm',
                'Create new cross-signing keys and a recovery key for the bot account? Use this only if the bot account has never set up recovery.'
            )
        );
        if (!ok) return;
        void run(async () => {
            const data = await createMatrixIdentity();
            setCreatedKey(data.recovery_key);
            setStatus(data.status);
        });
    };

    if (!configured) return null;

    const lastState = status?.lastResult?.state;
    const stateMessages: Record<string, string> = {
        no_key: t(
            'profile.matrix.crossSigning.stateNoKey',
            'Enter the recovery key of the bot account to verify its device.'
        ),
        no_recovery: t(
            'profile.matrix.crossSigning.stateNoRecovery',
            'This bot account has no recovery set up yet.'
        ),
        key_unreadable: t(
            'profile.matrix.crossSigning.stateKeyUnreadable',
            'The saved recovery key could not be decrypted (the server secret may have changed). Enter it again.'
        ),
        failed: t(
            'profile.matrix.crossSigning.stateFailed',
            'Verification failed. Check the recovery key.'
        ),
    };

    return (
        <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <ShieldCheckIcon className="w-5 h-5 mr-2 text-blue-500" />
                {t(
                    'profile.matrix.crossSigning.title',
                    'Device Verification (Cross-Signing)'
                )}
            </h4>

            <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
                <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                <p>
                    {t(
                        'profile.matrix.crossSigning.description',
                        'Element warns "Encrypted by a device not verified by its owner" until the bot signs its own device. Enter the recovery key (Security Key) of the bot account — set it up by signing in to Element as the bot. The key is stored encrypted.'
                    )}
                </p>
            </div>

            {/* 状態 */}
            <div
                className="mb-4 text-sm"
                data-testid="matrix-cross-signing-status"
            >
                {!status || !status.running ? (
                    <p className="text-gray-500 dark:text-gray-400">
                        {t(
                            'profile.matrix.crossSigning.notRunning',
                            'Start listening for messages to check the device status.'
                        )}
                    </p>
                ) : status.deviceVerified ? (
                    <p className="text-green-700 dark:text-green-400 font-medium">
                        ✓{' '}
                        {t(
                            'profile.matrix.crossSigning.verified',
                            'The bot device is verified.'
                        )}
                    </p>
                ) : (
                    <div className="text-amber-700 dark:text-amber-400">
                        <p className="font-medium">
                            {t(
                                'profile.matrix.crossSigning.notVerified',
                                'The bot device is not verified.'
                            )}
                        </p>
                        {lastState && stateMessages[lastState] && (
                            <p className="mt-1">{stateMessages[lastState]}</p>
                        )}
                        {status.lastResult?.message && (
                            <p className="mt-1 text-xs break-all">
                                {status.lastResult.message}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* 新しく作ったリカバリーキー（この場でしか表示しない） */}
            {createdKey && (
                <div className="mb-4 p-3 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 rounded">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                        {t(
                            'profile.matrix.crossSigning.createdKeyTitle',
                            'Save this recovery key somewhere safe. It is shown only once.'
                        )}
                    </p>
                    <code
                        className="block p-2 bg-white dark:bg-gray-800 rounded text-sm break-all select-all"
                        data-testid="matrix-created-recovery-key"
                    >
                        {createdKey}
                    </code>
                    <div className="mt-2 flex gap-2">
                        <button
                            type="button"
                            className={`${buttonClass} bg-gray-600 text-white hover:bg-gray-700`}
                            onClick={() => {
                                void navigator.clipboard
                                    ?.writeText(createdKey)
                                    .then(() =>
                                        showSuccessToast(
                                            t(
                                                'profile.matrix.crossSigning.copied',
                                                'Copied.'
                                            )
                                        )
                                    );
                            }}
                        >
                            {t('profile.matrix.crossSigning.copy', 'Copy')}
                        </button>
                        <button
                            type="button"
                            className={`${buttonClass} bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100`}
                            onClick={() => setCreatedKey(null)}
                        >
                            {t('profile.matrix.crossSigning.hide', 'Hide')}
                        </button>
                    </div>
                </div>
            )}

            {/* リカバリーキー */}
            <div className="mb-4">
                <label
                    htmlFor="matrixRecoveryKey"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                    {t(
                        'profile.matrix.crossSigning.recoveryKey',
                        'Recovery Key'
                    )}
                </label>
                <input
                    id="matrixRecoveryKey"
                    type="password"
                    autoComplete="off"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    placeholder={
                        status?.recoveryKeySet
                            ? t(
                                  'profile.matrix.crossSigning.keySet',
                                  '(recovery key already set — enter a new one to replace it)'
                              )
                            : 'EsTc ...'
                    }
                    className={inputClass}
                    data-testid="matrix-recovery-key-input"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                    <button
                        type="button"
                        disabled={busy || !recoveryKey.trim()}
                        onClick={() => void handleSaveKey()}
                        className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
                        data-testid="matrix-recovery-key-save"
                    >
                        {t('profile.matrix.crossSigning.saveKey', 'Save Key')}
                    </button>
                    {status?.recoveryKeySet && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleDeleteKey()}
                            className={`${buttonClass} bg-red-600 text-white hover:bg-red-700`}
                        >
                            {t(
                                'profile.matrix.crossSigning.deleteKey',
                                'Remove Key'
                            )}
                        </button>
                    )}
                    {status?.running &&
                        status.recoveryKeySet &&
                        !status.deviceVerified && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleVerify()}
                                className={`${buttonClass} bg-green-600 text-white hover:bg-green-700`}
                                data-testid="matrix-verify-device"
                            >
                                {t(
                                    'profile.matrix.crossSigning.verifyNow',
                                    'Verify Now'
                                )}
                            </button>
                        )}
                </div>
            </div>

            {/* リカバリーが無いアカウント向け: 新規作成 */}
            {status?.running && status.recoveryAvailable === false && (
                <div className="text-sm">
                    <p className="text-gray-600 dark:text-gray-300 mb-2">
                        {t(
                            'profile.matrix.crossSigning.createHint',
                            'No recovery is set up on the bot account. You can create new cross-signing keys and a recovery key here.'
                        )}
                    </p>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={handleCreate}
                        className={`${buttonClass} bg-gray-600 text-white hover:bg-gray-700`}
                        data-testid="matrix-create-identity"
                    >
                        {t(
                            'profile.matrix.crossSigning.create',
                            'Set Up Cross-Signing'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default MatrixCrossSigningSection;
