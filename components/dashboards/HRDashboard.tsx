import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardData } from '../../hooks/useDashboardData';
import StatCard from './StatCard';
import { useLanguage } from '../../context/LanguageContext';
import DistributionPieChart from './charts/DistributionPieChart';
import AlertsPanel from './AlertsPanel';
import { useDashboardSettings } from '../../context/DashboardSettingsContext';

interface HRDashboardProps {
    data: DashboardData;
}

const HRDashboard: React.FC<HRDashboardProps> = ({ data }) => {
    const { t } = useLanguage();
    const { settings } = useDashboardSettings();
    const navigate = useNavigate();

    const employeeDistribution = data.charts.employeeDistributionByDept.map(d => ({
        ...d,
        name: t(`departments.${d.name}`) || d.name
    }));

    return (
        <div className="space-y-6">
            {settings.stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon="fa-users" title={t('dashboard.hr.activeEmployees')} value={data.stats.activeEmployees} color="bg-green-500" onClick={() => navigate('/employees')} />
                    <StatCard icon="fa-user-plus" title={t('dashboard.hr.unhoused')} value={data.stats.unhousedEmployees} color="bg-primary-500" onClick={() => navigate('/employees')} />
                    <StatCard icon="fa-user-times" title={t('dashboard.hr.left')} value={data.employees.length - data.stats.activeEmployees} color="bg-gray-500" onClick={() => navigate('/employees')} />
                    <StatCard icon="fa-file-contract" title={t('dashboard.hr.expiringContracts')} value={data.stats.expiringContracts.length} color="bg-red-500" onClick={() => navigate('/employees')} />
                </div>
            )}
            
            {settings.alerts && <AlertsPanel expiringContracts={data.stats.expiringContracts} />}

            {settings.distributionChart && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 animate-fade-in-up">
                    <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">{t('dashboard.charts.employeesByDept')}</h3>
                    <DistributionPieChart data={employeeDistribution} />
                </div>
            )}
        </div>
    );
};

export default HRDashboard;