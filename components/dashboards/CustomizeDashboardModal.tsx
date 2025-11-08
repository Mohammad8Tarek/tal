import React from 'react';
import { useDashboardSettings, DashboardSettings } from '../../context/DashboardSettingsContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { User } from '../../types';

interface CustomizeDashboardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ROLE_HIERARCHY: User['roles'][number][] = ['super_admin', 'admin', 'manager', 'supervisor', 'hr', 'maintenance', 'viewer'];

const getPrimaryRole = (roles: User['roles']): User['roles'][number] => {
    if (!roles || roles.length === 0) return 'viewer'; // default
    // FIX: Corrected typo from ROLE_HIERARCH to ROLE_HIERARCHY.
    for (const role of ROLE_HIERARCHY) {
        if (roles.includes(role)) {
            return role;
        }
    }
    return roles[0]; // fallback
};

// Define which widgets are available for each role
const roleWidgets: Record<User['roles'][number], (keyof DashboardSettings)[]> = {
    super_admin: ['stats', 'occupancyChart', 'distributionChart', 'recentActivity'],
    admin: ['stats', 'occupancyChart', 'distributionChart', 'recentActivity'],
    manager: ['stats', 'alerts', 'occupancyChart', 'distributionChart'],
    supervisor: ['stats', 'availableRooms'],
    hr: ['stats', 'alerts', 'distributionChart'],
    maintenance: ['stats', 'maintenanceList'],
    viewer: ['stats']
};


const CustomizeDashboardModal: React.FC<CustomizeDashboardModalProps> = ({ isOpen, onClose }) => {
    const { settings, toggleWidget } = useDashboardSettings();
    const { t } = useLanguage();
    const { user } = useAuth();

    if (!isOpen) return null;

    const primaryRole = getPrimaryRole(user!.roles);
    const availableWidgets = roleWidgets[primaryRole] || roleWidgets.viewer;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('dashboard.customize.title')}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{t('dashboard.customize.description')}</p>
                <div className="space-y-4">
                    {availableWidgets.map((widgetKey) => (
                        <label key={widgetKey} htmlFor={widgetKey} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg cursor-pointer">
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{t(`dashboard.customize.${widgetKey}`)}</span>
                            <div className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    id={widgetKey}
                                    checked={settings[widgetKey]}
                                    onChange={() => toggleWidget(widgetKey)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-500 peer-checked:bg-primary-600"></div>
                            </div>
                        </label>
                    ))}
                </div>
                <div className="flex justify-end mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                        {t('login.forgotPasswordModal.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomizeDashboardModal;