import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClockIcon } from '@heroicons/react/24/outline';

interface WorkSummaryCardProps {
    totalWorkHours: number;
    unitPrice: number | null | undefined;
    defaultUnitPrice: number;
    onUnitPriceChange: (price: number) => Promise<void>;
}

const WorkSummaryCard: React.FC<WorkSummaryCardProps> = ({
    totalWorkHours,
    unitPrice,
    defaultUnitPrice,
    onUnitPriceChange,
}) => {
    const { t } = useTranslation();
    const effectivePrice = unitPrice ?? defaultUnitPrice;
    const [editPrice, setEditPrice] = useState<string>(String(effectivePrice));
    const [isSaving, setIsSaving] = useState(false);

    const manDays = totalWorkHours / 8;
    const totalCost = manDays * effectivePrice;

    const handleSavePrice = async () => {
        const parsed = parseInt(editPrice, 10);
        if (isNaN(parsed) || parsed < 0) return;
        setIsSaving(true);
        try {
            await onUnitPriceChange(parsed);
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSavePrice();
    };

    if (totalWorkHours === 0) {
        return (
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <ClockIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                    {t('project.workSummary', '作業時間集計')}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    {t('project.noWorkHours', '作業時間が記録されていません')}
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <ClockIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                {t('project.workSummary', '作業時間集計')}
            </h4>
            <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                        {t('project.totalHours', '合計')}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                        {totalWorkHours.toFixed(1)}h
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                        {t('project.manDays', '人工')}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                        {manDays.toFixed(1)}{t('project.manDaysUnit', '人工')}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {t('project.unitPrice', '単価')}
                    </span>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-500 dark:text-gray-400 text-xs">¥</span>
                        <input
                            type="number"
                            min="0"
                            step="1000"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-24 border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 text-sm text-right bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                            /{t('project.manDaysUnit', '人工')}
                        </span>
                        <button
                            onClick={handleSavePrice}
                            disabled={isSaving}
                            className="px-2 py-0.5 text-xs bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors"
                        >
                            {t('common.save', 'Save')}
                        </button>
                    </div>
                </div>
                <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">
                        {t('project.totalCost', '金額')}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                        ¥{Math.round(totalCost).toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default WorkSummaryCard;
