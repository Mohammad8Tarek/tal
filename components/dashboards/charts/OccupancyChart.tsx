import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../../../context/LanguageContext';

interface OccupancyData {
    name: string;
    occupancy: number;
    total: number;
}

interface OccupancyChartProps {
    data: OccupancyData[];
}

const OccupancyChart: React.FC<OccupancyChartProps> = ({ data }) => {
    const { t } = useLanguage();
    const chartData = data.map(item => ({
        name: item.name,
        [t('dashboard.charts.occupied')]: item.occupancy,
        [t('dashboard.charts.available')]: item.total - item.occupancy,
    }));
    
    const theme = localStorage.getItem('theme') || 'light';
    const tooltipStyle = theme === 'dark' 
        ? {
            backgroundColor: 'rgba(30, 41, 59, 0.9)',
            borderColor: '#475569',
            borderRadius: '0.5rem',
          }
        : {
            backgroundColor: '#ffffff',
            borderColor: '#e2e8f0',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          };
    const labelStyle = theme === 'dark' ? { color: '#F8FAFC' } : { color: '#334155' };

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={labelStyle}
                    cursor={{fill: 'rgba(100, 116, 139, 0.1)'}}
                />
                <Legend />
                <Bar dataKey={t('dashboard.charts.occupied')} stackId="a" fill="#3B82F6" />
                <Bar dataKey={t('dashboard.charts.available')} stackId="a" fill="#D1D5DB" />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default OccupancyChart;