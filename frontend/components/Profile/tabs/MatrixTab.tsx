import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    InformationCircleIcon,
    CogIcon,
    ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import MatrixIcon from '../../Shared/Icons/MatrixIcon';
import { getApiPath } from '../../../config/paths';
import { getCsrfToken } from '../../../utils/csrfService';
import { useToast } from '../../Shared/ToastContext';
import type { ProfileFormData } from '../types';

interface MatrixSettings {
    matrix_homeserver_url: string;
    matrix_access_token: string;
    matrix_room_id: string;
    matrix_bot_user_id: string;
    matrix_allowed_users: string[];
    configured: boolean;
}

interface MatrixTabProps {
    isActive: boolean;
    saveRef?: React.MutableRefObject<(() => Promise<void>) | null>;
    formData?: ProfileFormData;
    onToggleSummary?: () => void;
    onSelectFrequency?: (frequency: string) => void;
    onSendTestSummary?: () => void;
    formatFrequency?: (frequency: string) => string;
}

const MatrixTab: React.FC<MatrixTabProps> = ({
    isActive,
    saveRef,
    formData,
    onToggleSummary,
    onSelectFrequency,
    onSendTestSummary,
    formatFrequency,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    // --- すべての state / ref / effect を early return より前に置く ---

    const [settings, setSettings] = useState<MatrixSettings>({
        matrix_homeserver_url: '',
        matrix_access_token: '',
        matrix_room_id: '',
        matrix_bot_user_id: '',
        matrix_allowed_users: [],
        configured: false,
    });
    const [allowedUsersInput, setAllowedUsersInput] = useState('');
    const [isPolling, setIsPolling] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [connectionTestResult, setConnectionTestResult] = useState<{
        status: 'idle' | 'loading' | 'ok' | 'error';
        message?: string;
    }>({ status: 'idle' });

    // 設定ロード
    useEffect(() => {
        if (!isActive || loaded) return;

        const load = async () => {
            try {
                const [settingsRes, statusRes] = await Promise.all([
                    fetch(getApiPath('matrix/settings')),
                    fetch(getApiPath('matrix/polling-status')),
                ]);

                if (settingsRes.ok) {
                    const data: MatrixSettings = await settingsRes.json();
                    setSettings(data);
                    setAllowedUsersInput(data.matrix_allowed_users.join(', '));
                }
                if (statusRes.ok) {
                    const data = await statusRes.json();
                    setIsPolling(data.status?.running ?? false);
                }
            } catch (err) {
                console.error('Error loading Matrix settings:', err);
            } finally {
                setLoaded(true);
            }
        };

        load();
    }, [isActive, loaded]);

    // saveRef に最新の handleSave を登録する仕組み
    // handleSave は毎レンダーで state を参照するため ref で最新版を保持する
    const handleSaveLatestRef = useRef<() => Promise<void>>(async () => {});

    useEffect(() => {
        if (saveRef) {
            saveRef.current = () => handleSaveLatestRef.current();
        }
    }, [saveRef]);

    // --- early return（hooks はすべて上で完了済み）---
    if (!isActive) return null;

    // --- ここより下は isActive === true の場合のみ実行される ---

    const handleTestConnection = async () => {
        setConnectionTestResult({ status: 'loading' });
        try {
            const response = await fetch(getApiPath('matrix/test-connection'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': await getCsrfToken(),
                },
            });
            const data = await response.json();
            if (!response.ok) {
                setConnectionTestResult({ status: 'error', message: data.error });
            } else {
                setConnectionTestResult({
                    status: 'ok',
                    message: `Connected as ${data.userId}`,
                });
            }
        } catch (err) {
            setConnectionTestResult({ status: 'error', message: (err as Error).message });
        }
    };

    const handleStartPolling = async () => {
        try {
            const response = await fetch(getApiPath('matrix/start-polling'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': await getCsrfToken(),
                },
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to start Matrix polling');
            }
            setIsPolling(true);
            showSuccessToast(t('profile.matrix.pollingStarted', 'Matrix polling started.'));
        } catch (error) {
            showErrorToast((error as Error).message);
        }
    };

    const handleStopPolling = async () => {
        try {
            const response = await fetch(getApiPath('matrix/stop-polling'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': await getCsrfToken(),
                },
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to stop Matrix polling');
            }
            setIsPolling(false);
            showSuccessToast(t('profile.matrix.pollingStopped', 'Matrix polling stopped.'));
        } catch (error) {
            showErrorToast((error as Error).message);
        }
    };

    // 最新の handleSave を ref に登録（レンダーごとに更新）
    const handleSave = async () => {
        if (!loaded) return;
        try {
            const allowedUsers = allowedUsersInput
                .split(',')
                .map((u) => u.trim())
                .filter(Boolean);

            const response = await fetch(getApiPath('matrix/settings'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': await getCsrfToken(),
                },
                body: JSON.stringify({
                    matrix_homeserver_url: settings.matrix_homeserver_url || null,
                    matrix_access_token: settings.matrix_access_token || null,
                    matrix_room_id: settings.matrix_room_id || null,
                    matrix_bot_user_id: settings.matrix_bot_user_id || null,
                    matrix_allowed_users: allowedUsers,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save Matrix settings');
            }

            const isConfigured = !!(
                settings.matrix_homeserver_url &&
                settings.matrix_access_token &&
                settings.matrix_room_id
            );
            setSettings((prev) => ({ ...prev, configured: isConfigured }));
            showSuccessToast(t('profile.matrix.settingsSaved', 'Matrix settings saved successfully.'));

            if (isConfigured && !isPolling) {
                await handleStartPolling();
            }
        } catch (error) {
            showErrorToast((error as Error).message);
        }
    };

    // レンダーごとに ref を最新版で更新する
    handleSaveLatestRef.current = handleSave;

    const inputClass =
        'mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100';
    const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300';

    return (
        <div className="mb-8">
            <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-6 flex items-center">
                <MatrixIcon className="w-6 h-6 mr-3 text-blue-500" />
                {t('profile.matrix.title', 'Matrix Integration')}
            </h3>

            <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <CogIcon className="w-5 h-5 mr-2 text-blue-500" />
                    {t('profile.matrix.botSetup', 'Bot Setup')}
                </h4>

                <div className="space-y-4">
                    <div className="text-sm text-gray-600 dark:text-gray-300 flex items-start">
                        <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                        <p>
                            {t(
                                'profile.matrix.description',
                                'Connect tududi to a Matrix room to add items to your inbox via messages. Create a bot account on your homeserver and paste its credentials below.'
                            )}
                        </p>
                    </div>

                    {/* Homeserver URL */}
                    <div>
                        <label className={labelClass}>
                            {t('profile.matrix.homeserverUrl', 'Homeserver URL')}
                        </label>
                        <input
                            type="url"
                            value={settings.matrix_homeserver_url}
                            onChange={(e) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    matrix_homeserver_url: e.target.value,
                                }))
                            }
                            placeholder="https://matrix.example.com"
                            className={inputClass}
                        />
                    </div>

                    {/* Access Token */}
                    <div>
                        <label className={labelClass}>
                            {t('profile.matrix.accessToken', 'Access Token')}
                        </label>
                        <input
                            type="password"
                            value={settings.matrix_access_token}
                            onChange={(e) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    matrix_access_token: e.target.value,
                                }))
                            }
                            placeholder={
                                settings.configured
                                    ? t('profile.matrix.tokenSet', '(token already set — leave blank to keep)')
                                    : 'syt_...'
                            }
                            className={inputClass}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'profile.matrix.accessTokenHelp',
                                "Obtain via: curl -XPOST 'https://YOUR_HOMESERVER/_matrix/client/v3/login' -H 'Content-Type: application/json' -d '{\"type\":\"m.login.password\",\"user\":\"bot\",\"password\":\"PASSWORD\"}'"
                            )}
                        </p>
                    </div>

                    {/* Bot User ID */}
                    <div>
                        <label className={labelClass}>
                            {t('profile.matrix.botUserId', 'Bot User ID')}
                        </label>
                        <input
                            type="text"
                            value={settings.matrix_bot_user_id}
                            onChange={(e) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    matrix_bot_user_id: e.target.value,
                                }))
                            }
                            placeholder="@tududi-bot:example.com"
                            className={inputClass}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'profile.matrix.botUserIdHelp',
                                "The bot's full Matrix user ID. Used to ignore the bot's own messages."
                            )}
                        </p>
                    </div>

                    {/* Room ID */}
                    <div>
                        <label className={labelClass}>
                            {t('profile.matrix.roomId', 'Room ID')}
                        </label>
                        <input
                            type="text"
                            value={settings.matrix_room_id}
                            onChange={(e) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    matrix_room_id: e.target.value,
                                }))
                            }
                            placeholder="!abcdefghij:example.com"
                            className={inputClass}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'profile.matrix.roomIdHelp',
                                'Find it in Element: Room Settings → Advanced → Internal room ID.'
                            )}
                        </p>
                    </div>

                    {/* Allowed Users */}
                    <div>
                        <label className={labelClass}>
                            {t('profile.matrix.allowedUsers', 'Allowed Users')}
                        </label>
                        <input
                            type="text"
                            value={allowedUsersInput}
                            onChange={(e) => setAllowedUsersInput(e.target.value)}
                            placeholder="@alice:example.com, @bob:example.com"
                            className={inputClass}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'profile.matrix.allowedUsersHelp',
                                'Comma-separated list of Matrix user IDs allowed to send messages. Leave blank to allow all users in the room.'
                            )}
                        </p>
                    </div>

                    {/* Connection Test */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={!settings.configured || connectionTestResult.status === 'loading'}
                            className={`px-4 py-2 rounded-md text-sm ${
                                !settings.configured || connectionTestResult.status === 'loading'
                                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                    : 'bg-gray-600 text-white hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600'
                            }`}
                        >
                            {connectionTestResult.status === 'loading'
                                ? t('profile.matrix.testing', 'Testing...')
                                : t('profile.matrix.testConnection', 'Test Connection')}
                        </button>
                        {connectionTestResult.status === 'ok' && (
                            <span className="text-sm text-green-600 dark:text-green-400">
                                ✓ {connectionTestResult.message}
                            </span>
                        )}
                        {connectionTestResult.status === 'error' && (
                            <span className="text-sm text-red-600 dark:text-red-400">
                                ✗ {connectionTestResult.message}
                            </span>
                        )}
                    </div>

                    {/* Connection status */}
                    {settings.configured && (
                        <div className="p-3 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800 rounded text-green-800 dark:text-green-200 text-sm">
                            <p className="font-medium mb-2">
                                {t('profile.matrix.configured', 'Matrix bot configured')}
                            </p>
                            <div className="flex items-center mb-2">
                                <div
                                    className={`w-3 h-3 rounded-full mr-2 ${isPolling ? 'bg-green-500' : 'bg-red-500'}`}
                                />
                                <span>
                                    {isPolling
                                        ? t('profile.matrix.pollingActive', 'Listening for messages')
                                        : t('profile.matrix.pollingInactive', 'Not listening')}
                                </span>
                            </div>
                            <div className="flex gap-2 mt-2">
                                {isPolling ? (
                                    <button
                                        type="button"
                                        onClick={handleStopPolling}
                                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                                    >
                                        {t('profile.matrix.stopPolling', 'Stop')}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleStartPolling}
                                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                    >
                                        {t('profile.matrix.startPolling', 'Start')}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Task Summary Notifications */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <ClipboardDocumentListIcon className="w-5 h-5 mr-2 text-green-500" />
                    {t('profile.taskSummaryNotifications', 'Task Summary Notifications')}
                </h4>

                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
                    <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                    <p>
                        {t(
                            'profile.matrix.taskSummaryDescription',
                            'Receive regular summaries of your tasks via Matrix. This feature requires your Matrix integration to be configured.'
                        )}
                    </p>
                </div>

                <div className="mb-4 flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('profile.enableTaskSummary', 'Enable Task Summaries')}
                    </label>
                    <div
                        className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                            formData?.task_summary_enabled
                                ? 'bg-blue-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        onClick={onToggleSummary}
                    >
                        <span
                            className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                                formData?.task_summary_enabled
                                    ? 'translate-x-6'
                                    : 'translate-x-0'
                            }`}
                        />
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('profile.summaryFrequency', 'Summary Frequency')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {['1h', '2h', '4h', '8h', '12h', 'daily', 'weekly'].map((frequency) => (
                            <button
                                key={frequency}
                                type="button"
                                className={`px-3 py-1.5 text-sm rounded-full ${
                                    formData?.task_summary_frequency === frequency
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                                onClick={() => onSelectFrequency?.(frequency)}
                            >
                                {t(
                                    `profile.frequency.${frequency}`,
                                    formatFrequency?.(frequency) ?? frequency
                                )}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {t('profile.frequencyHelp', 'Choose how often you want to receive task summaries.')}
                    </p>
                </div>

                <div className="mt-4">
                    <button
                        type="button"
                        disabled={!settings.configured}
                        className={`px-4 py-2 rounded-md ${
                            !settings.configured
                                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                        }`}
                        onClick={onSendTestSummary}
                    >
                        {t('profile.sendTestSummary', 'Send Test Summary')}
                    </button>
                    {!settings.configured && (
                        <p className="mt-2 text-xs text-red-500">
                            {t(
                                'profile.matrix.requiredForSummaries',
                                'Matrix integration must be configured to use task summaries.'
                            )}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MatrixTab;
