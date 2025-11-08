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

    const neumorphicContainer = "bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 animate-fade-in-up shadow-[5px_5px_10px_#d1d9e6,-5px_-5px_10px_#ffffff] dark:shadow-[5px_5px_10px_#1e293b,-5px_-5px_10px_#334155]";

    return (
        <div className="space-y-6">
            {/* Stats */}
            {settings.stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    <StatCard icon="fa-users" title={t('employees.title')} value={data.stats.totalEmployees} gradient="bg-gradient-to-br from-blue-500 to-blue-600" onClick={() => navigate('/employees')} trendData={[115, 116, 118, 117, 120]} />
                    <StatCard icon="fa-building" title={t('housing.buildings')} value={data.stats.totalBuildings} gradient="bg-gradient-to-br from-green-500 to-green-600" onClick={() => navigate('/housing')} />
                    <StatCard icon="fa-door-closed" title={t('housing.tabs.rooms')} value={data.stats.totalRooms} gradient="bg-gradient-to-br from-indigo-500 to-indigo-600" onClick={() => navigate('/housing')} trendData={[140, 142, 141, 145, 148]} />
                    <StatCard icon="fa-users-cog" title={t('dashboard.admin.totalUsers')} value={data.users.length} gradient="bg-gradient-to-br from-purple-500 to-purple-600" onClick={() => navigate('/users')} />
                    <StatCard icon="fa-history" title={t('dashboard.admin.totalLogs')} value={data.activityLogs.length} gradient="bg-gradient-to-br from-gray-500 to-gray-600" onClick={() => navigate('/activity-log')} />
                </div>
            )}

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Occupancy by Building Chart */}
                {settings.occupancyChart && (
                    <div className={neumorphicContainer}>
                        <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200 px-2">{t('dashboard.charts.occupancyByBuilding')}</h3>
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
