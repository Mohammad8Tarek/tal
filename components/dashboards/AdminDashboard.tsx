import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardData } from '../../hooks/useDashboardData';
import StatCard from './StatCard';
import { useLanguage } from '../../context/LanguageContext';
import OccupancyChart from './charts/OccupancyChart';
import { useDashboardSettings } from '../../context/DashboardSettingsContext';
import OccupancyRadialChart from './charts/OccupancyRadialChart';

interface AdminDashboardProps {
    data: DashboardData;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ data }) => {
    const { t } = useLanguage();
    const { settings } = useDashboardSettings();
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            {/* Stats */}
            {settings.stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    <StatCard icon="fa-users" title={t('employees.title')} value={data.stats.totalEmployees} color="bg-blue-500" onClick={() => navigate('/employees')} />
                    <StatCard icon="fa-building" title={t('housing.buildings')} value={data.stats.totalBuildings} color="bg-green-500" onClick={() => navigate('/housing')} />
                    <StatCard icon="fa-door-closed" title={t('housing.tabs.rooms')} value={data.stats.totalRooms} color="bg-indigo-500" onClick={() => navigate('/housing')} />
                    <StatCard icon="fa-users-cog" title={t('dashboard.admin.totalUsers')} value={data.users.length} color="bg-purple-500" onClick={() => navigate('/users')} />
                    <StatCard icon="fa-history" title={t('dashboard.admin.totalLogs')} value={data.activityLogs.length} color="bg-gray-500" onClick={() => navigate('/activity-log')} />
                </div>
            )}

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Occupancy by Building Chart */}
                {settings.occupancyChart && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 animate-fade-in-up">
                        <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">{t('dashboard.charts.occupancyByBuilding')}</h3>
                        <OccupancyChart data={data.charts.occupancyByBuilding} />
                    </div>
                )}
                
                {/* Overall Occupancy Radial Chart */}
                <OccupancyRadialChart occupancyRate={data.stats.occupancyRate} />
            </div>
        </div>
    );
};

export default AdminDashboard;