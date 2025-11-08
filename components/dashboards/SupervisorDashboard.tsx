import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardData } from '../../hooks/useDashboardData';
import StatCard from './StatCard';
import { useLanguage } from '../../context/LanguageContext';
import { Room } from '../../types';
import { useDashboardSettings } from '../../context/DashboardSettingsContext';

interface SupervisorDashboardProps {
    data: DashboardData;
}

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ data }) => {
    const { t } = useLanguage();
    const { settings } = useDashboardSettings();
    const navigate = useNavigate();

    const availableRooms = data.rooms.filter(r => r.status === 'available' && r.currentOccupancy < r.capacity);

    return (
        <div className="space-y-6">
            {settings.stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard icon="fa-door-open" title={t('dashboard.supervisor.availableRooms')} value={data.stats.availableRooms} color="bg-green-500" onClick={() => navigate('/housing')} />
                    <StatCard icon="fa-wrench" title={t('dashboard.supervisor.openTickets')} value={data.stats.openMaintenance} color="bg-yellow-500" onClick={() => navigate('/maintenance')} />
                    <StatCard icon="fa-user-plus" title={t('dashboard.supervisor.unhousedEmployees')} value={data.stats.unhousedEmployees} color="bg-primary-500" onClick={() => navigate('/employees')} />
                </div>
            )}
            
            {settings.availableRooms && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md animate-fade-in-up">
                    <h3 className="text-lg font-semibold p-4 border-b dark:border-slate-700 text-slate-800 dark:text-slate-200">{t('dashboard.supervisor.availableRoomsList')}</h3>
                    <div className="overflow-y-auto max-h-96">
                        {availableRooms.length > 0 ? (
                            <ul className="divide-y dark:divide-slate-700">
                            {availableRooms.map((room: Room) => {
                                return (
                                    <li key={room.id} className="p-4 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white">{room.roomNumber}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('housing.capacity')}: {room.currentOccupancy} / {room.capacity}</p>
                                        </div>
                                    </li>
                                );
                            })}
                            </ul>
                        ) : (
                            <p className="p-4 text-slate-500 dark:text-slate-400">{t('dashboard.supervisor.noAvailableRooms')}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupervisorDashboard;