import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import useDashboardData from '../hooks/useDashboardData';
import { DashboardSettingsProvider, useDashboardSettings } from '../context/DashboardSettingsContext';
import CustomizeDashboardModal from '../components/dashboards/CustomizeDashboardModal';

// Import role-specific dashboards
import AdminDashboard from '../components/dashboards/AdminDashboard';
import ManagerDashboard from '../components/dashboards/ManagerDashboard';
import SupervisorDashboard from '../components/dashboards/SupervisorDashboard';
import HRDashboard from '../components/dashboards/HRDashboard';
import MaintenanceDashboard from '../components/dashboards/MaintenanceDashboard';
import GenericDashboard from '../components/dashboards/GenericDashboard';
import { User } from '../types';

const DashboardPage: React.FC = () => {
    return (
      <DashboardSettingsProvider>
        <DashboardContent />
      </DashboardSettingsProvider>
    );
};

const ROLE_HIERARCHY: User['roles'][number][] = ['super_admin', 'admin', 'manager', 'supervisor', 'hr', 'maintenance', 'viewer'];

const getPrimaryRole = (roles: User['roles']): User['roles'][number] => {
    if (!roles || roles.length === 0) return 'viewer'; // default
    for (const role of ROLE_HIERARCHY) {
        if (roles.includes(role)) {
            return role;
        }
    }
    return roles[0]; // fallback
};


const DashboardContent: React.FC = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { data, loading } = useDashboardData();
    const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
    const { settings } = useDashboardSettings();

    const renderDashboard = () => {
        if (!data || !user) return null;

        const primaryRole = getPrimaryRole(user.roles);

        switch (primaryRole) {
            case 'super_admin':
            case 'admin':
                return <AdminDashboard data={data} />;
            case 'manager':
                return <ManagerDashboard data={data} />;
            case 'supervisor':
                return <SupervisorDashboard data={data} />;
            case 'hr':
                return <HRDashboard data={data} />;
            case 'maintenance':
                return <MaintenanceDashboard data={data} />;
            default:
                return <GenericDashboard data={data} />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h1 className="text-4xl font-bold text-slate-800 dark:text-white">{t('dashboard.welcome', { name: user?.username })}</h1>
                 <button onClick={() => setIsCustomizeModalOpen(true)} className="px-4 py-2 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-sm">
                    <i className="fas fa-cog me-2"></i>
                    {t('dashboard.customize.title')}
                 </button>
            </div>
            
            {renderDashboard()}

            {isCustomizeModalOpen && (
                <CustomizeDashboardModal 
                    isOpen={isCustomizeModalOpen} 
                    onClose={() => setIsCustomizeModalOpen(false)}
                />
            )}
        </div>
    );
};

export default DashboardPage;