import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardData } from '../../hooks/useDashboardData';
import StatCard from './StatCard';
import { useLanguage } from '../../context/LanguageContext';
import DistributionPieChart from './charts/DistributionPieChart';
import OccupancyChart from './charts/OccupancyChart';
import AlertsPanel from './AlertsPanel';
import { useDashboardSettings } from '../../context/DashboardSettingsContext';
import OccupancyRadialChart from './charts/OccupancyRadialChart';

interface ManagerDashboardProps {
    data: DashboardData;
}

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ data }) => {
    const { t } = useLanguage();
    const { settings } = useDashboardSettings();
    const navigate = useNavigate();

    const employeeDistribution = data.charts.employeeDistributionByDept.map(d => ({
        ...d,
        name: t(`departments.${d.name}`) || d.name
    }));
    
    const cardContainer = "bg-white dark:bg-slate-800 rounded-2xl p-4 animate-fade-in-up shadow-md";


    return (
        <div className="space-y-6">
            {settings.stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon="fa-door-open" title={t('dashboard.manager.availableRooms')} value={data.stats.availableRooms} gradient="bg-gradient-to-br from-green-400 to-green-600" onClick={() => navigate('/housing')} />
                    <StatCard icon="fa-wrench" title={t('dashboard.manager.openTickets')} value={data.stats.openMaintenance} gradient="bg-gradient-to-br from-yellow-400 to-orange-600" onClick={() => navigate('/maintenance')} />
                    <StatCard icon="fa-file-contract" title={t('dashboard.manager.expiringContracts')} value={data.stats.expiringContracts.length} gradient="bg-gradient-to-br from-red-400 to-red-600" onClick={() => navigate('/employees')} />
                    <StatCard icon="fa-users" title={t('employees.title')} value={data.stats.totalEmployees} gradient="bg-gradient-to-br from-blue-400 to-blue-600" onClick={() => navigate('/employees')} />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {settings.occupancyChart && (
                        <div className={cardContainer}>
                            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200 px-2">{t('dashboard.charts.occupancyByBuilding')}</h3>
                            <OccupancyChart data={data.charts.occupancyByBuilding} />
                        </div>
                    )}
                    {settings.distributionChart && (
                        <div className={cardContainer}>
                            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200 px-2">{t('dashboard.charts.employeesByDept')}</h3>
                            <DistributionPieChart data={employeeDistribution} />
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <OccupancyRadialChart occupancyRate={data.stats.occupancyRate} />
                    {settings.alerts && <AlertsPanel expiringContracts={data.stats.expiringContracts} />}
                </div>
            </div>
        </div>
    );
};

export default ManagerDashboard;
