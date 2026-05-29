import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { InformationCircleIcon, CogIcon } from '@heroicons/react/24/outline';
import MatrixIcon from '../../Shared/Icons/MatrixIcon';
import { getApiPath } from '../../../config/paths';
import { getCsrfToken } from '../../../utils/csrfService';
import { useToast } from '../../Shared/ToastContext';

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
}

const MatrixTab: React.FC<MatrixTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

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
    const [saveStatus, setSaveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [loaded, setLoaded] = useState(false);

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

    if (!isActive) return null;

    const handleSave = async () => {
        setSaveStatus('loading');
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

            setSaveStatus('success');
            setSettings((prev) => ({
                ...prev,
                configured: !!(
                    settings.matrix_homeserver_url &&
                    settings.matrix_access_token &&
                    settings.matrix_room_id
                ),
            }));
            showSuccessToast(t('profile.matrix.settingsSaved', 'Matrix settings saved successfully.'));

            // Auto-start polling if configured
            if (
                settings.matrix_homeserver_url &&
                settings.matrix_access_token &&
                settings.matrix_room_id &&
                !isPolling
            ) {
                await handleStartPolling();
            }
        } catch (error) {
            setSaveStatus('error');
            showErrorToast((error as Error).message);
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
                                'Obtain via: curl -XPOST \'https://YOUR_HOMESERVER/_matrix/client/v3/login\' -H \'Content-Type: application/json\' -d \'{"type":"m.login.password","user":"bot","password":"PASSWORD"}\''
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

                    {/* Save button */}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saveStatus === 'loading'}
                        className={`px-4 py-2 rounded-md ${
                            saveStatus === 'loading'
                                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                        }`}
                    >
                        {saveStatus === 'loading'
                            ? t('profile.matrix.saving', 'Saving...')
                            : t('profile.matrix.saveSettings', 'Save Matrix Settings')}
                    </button>

                    {saveStatus === 'error' && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                            {t('profile.matrix.saveFailed', 'Failed to save settings. Please check your values.')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MatrixTab;
