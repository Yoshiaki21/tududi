import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClockIcon } from '@heroicons/react/24/outline';

interface TaskWorkHoursCardProps {
    workHours: number | null | undefined;
    onUpdate: (value: number | null) => Promise<void>;
}

const TaskWorkHoursCard: React.FC<TaskWorkHoursCardProps> = ({
    workHours,
    onUpdate,
}) => {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState<string>(
        workHours != null ? String(workHours) : ''
    );

    const handleStartEdit = () => {
        setEditValue(workHours != null ? String(workHours) : '');
        setIsEditing(true);
    };

    const handleSave = async () => {
        const parsed = editValue === '' ? null : parseFloat(editValue);
        if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;
        await onUpdate(parsed);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditValue(workHours != null ? String(workHours) : '');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancel();
    };

    return (
        <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('task.workHours', '作業時間')}
            </h4>
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-4 transition-colors">
                {isEditing ? (
                    <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="例: 1.5"
                                autoFocus
                                className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <span className="text-sm text-gray-500 dark:text-gray-400">h</span>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                            >
                                {t('common.save', 'Save')}
                            </button>
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={handleStartEdit}
                        className="flex w-full items-center justify-between text-left"
                    >
                        {workHours != null ? (
                            <div className="flex items-center space-x-2">
                                <ClockIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {workHours}h
                                </span>
                            </div>
                        ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                {t('task.noWorkHours', '作業時間未入力')}
                            </span>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default TaskWorkHoursCard;
