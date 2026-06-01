import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleStackIcon, TrashIcon } from '@heroicons/react/24/outline';
import { getApiPath } from '../../../config/paths';
import { getCsrfToken } from '../../../utils/csrfService';
import { useToast } from '../../Shared/ToastContext';

interface StorageTabProps {
    isActive: boolean;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

const StorageTab: React.FC<StorageTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [isRunning, setIsRunning] = useState(false);
    const [lastResult, setLastResult] = useState<{ deletedCount: number; freedBytes: number } | null>(null);

    if (!isActive) return null;

    const handleCleanup = async () => {
        setIsRunning(true);
        setLastResult(null);
        try {
            const response = await fetch(getApiPath('cleanup/orphaned-attachments'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'x-csrf-token': await getCsrfToken() },
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Cleanup failed');
            }
            const result = await response.json();
            setLastResult(result);
            if (result.deletedCount === 0) {
                showSuccessToast(t('profile.storage.noOrphans', '孤立したファイルは見つかりませんでした。'));
            } else {
                showSuccessToast(
                    t('profile.storage.cleanupDone', '{{count}} 件のファイルを削除し、{{size}} を解放しました。', {
                        count: result.deletedCount,
                        size: formatBytes(result.freedBytes),
                    })
                );
            }
        } catch (error) {
            showErrorToast((error as Error).message);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <CircleStackIcon className="w-6 h-6 mr-3 text-indigo-500" />
                {t('profile.storage.title', 'ストレージ')}
            </h3>

            <div className="space-y-6">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('profile.storage.cleanupTitle', '孤立した添付ファイルを削除')}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {t(
                                    'profile.storage.cleanupDescription',
                                    'タスク・プロジェクト・ノートのいずれにも紐付いていない添付ファイルを削除します。'
                                )}
                            </p>
                            {lastResult && (
                                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                    {lastResult.deletedCount === 0
                                        ? t('profile.storage.noOrphans', '孤立したファイルは見つかりませんでした。')
                                        : t('profile.storage.cleanupDone', '{{count}} 件のファイルを削除し、{{size}} を解放しました。', {
                                              count: lastResult.deletedCount,
                                              size: formatBytes(lastResult.freedBytes),
                                          })}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={handleCleanup}
                            disabled={isRunning}
                            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <TrashIcon className="w-4 h-4" />
                            {isRunning
                                ? t('profile.storage.running', '実行中...')
                                : t('profile.storage.runCleanup', 'クリーンアップを実行')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StorageTab;
