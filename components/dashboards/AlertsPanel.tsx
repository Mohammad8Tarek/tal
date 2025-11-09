import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Employee } from '../../types';

interface AlertsPanelProps {
    expiringContracts: Employee[];
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({ expiringContracts }) => {
    const { t } = useLanguage();

    if (expiringContracts.length === 0) {
        return null;
    }
    
    const getDaysRemaining = (dateString: string) => {
        const diff = new Date(dateString).getTime() - new Date().getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
    }
    
    const cardContainer = "bg-white dark:bg-slate-800 rounded-2xl animate-fade-in-up shadow-md";


    return (
        <div className={cardContainer}>
            <h3 className="text-lg font-semibold p-4 border-b dark:border-slate-700 text-yellow-600 dark:text-yellow-400 flex items-center">
                <i className="fas fa-exclamation-triangle mr-3"></i>
                {t('dashboard.alerts.title')}
            </h3>
            <ul className="divide-y dark:divide-slate-700 max-h-80 overflow-y-auto">
                {expiringContracts.map(employee => {
                    const daysRemaining = getDaysRemaining(employee.contractEndDate);
                    const fullName = `${employee.firstName} ${employee.lastName}`;
                    return (
                        <li key={employee.id} className="p-4 flex items-center space-x-3 rtl:space-x-reverse">
                             <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${daysRemaining < 7 ? 'bg-red-100 dark:bg-red-900' : 'bg-yellow-100 dark:bg-yellow-900'}`}>
                                <i className={`fas fa-file-contract ${daysRemaining < 7 ? 'text-red-500' : 'text-yellow-500'}`}></i>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{t('dashboard.alerts.contractEnding', { name: fullName })}</p>
                                <p className={`text-xs ${daysRemaining < 7 ? 'text-red-500 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {t('dashboard.alerts.daysRemaining', { count: daysRemaining })}
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default AlertsPanel;
