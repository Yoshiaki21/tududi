import type { KeyboardShortcutsConfig } from '../../utils/keyboardShortcutsService';

export interface ProfileSettingsProps {
    currentUser: { uid: string; email: string };
    isDarkMode?: boolean;
    toggleDarkMode?: () => void;
}

export interface NotificationPreferences {
    dueTasks: {
        inApp: boolean;
        email: boolean;
        push: boolean;
        telegram: boolean;
        matrix: boolean;
    };
    overdueTasks: {
        inApp: boolean;
        email: boolean;
        push: boolean;
        telegram: boolean;
        matrix: boolean;
    };
    dueProjects: {
        inApp: boolean;
        email: boolean;
        push: boolean;
        telegram: boolean;
        matrix: boolean;
    };
    overdueProjects: {
        inApp: boolean;
        email: boolean;
        push: boolean;
        telegram: boolean;
        matrix: boolean;
    };
    deferUntil: {
        inApp: boolean;
        email: boolean;
        push: boolean;
        telegram: boolean;
        matrix: boolean;
    };
}

export interface Profile {
    uid: string;
    email: string;
    name?: string;
    surname?: string;
    appearance: 'light' | 'dark';
    language: string;
    timezone: string;
    first_day_of_week: number;
    avatar_image: string | null;
    has_password: boolean;
    telegram_bot_token: string | null;
    telegram_chat_id: string | null;
    telegram_allowed_users: string | null;
    matrix_homeserver_url: string | null;
    matrix_access_token: string | null;
    matrix_room_id: string | null;
    matrix_bot_user_id: string | null;
    task_summary_enabled: boolean;
    task_summary_frequency: string;
    task_intelligence_enabled: boolean;
    auto_suggest_next_actions_enabled: boolean;
    productivity_assistant_enabled: boolean;
    next_task_suggestion_enabled: boolean;
    pomodoro_enabled: boolean;
    notification_preferences?: NotificationPreferences | null;
    keyboard_shortcuts?: KeyboardShortcutsConfig | null;
    default_unit_price?: number | null;
}

export interface TelegramBotInfo {
    username: string;
    first_name?: string;
    polling_status: any;
    chat_url: string;
}

export type ProfileFormData = Partial<
    Profile & {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    }
>;
