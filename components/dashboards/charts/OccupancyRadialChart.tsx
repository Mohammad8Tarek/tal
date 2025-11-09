import React from 'react';
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import { useLanguage } from '../../../context/LanguageContext';

interface OccupancyRadialChartProps {
    occupancyRate: number;
}

const OccupancyRadialChart: React.FC<OccupancyRadialChartProps> = ({ occupancyRate }) => {
    const { t } = useLanguage();
    const data = [{ name: t('dashboard.admin.occupancy'), value: occupancyRate }];
    
    const theme = localStorage.getItem('theme') || 'light';
    const fill = '#3B82F6';
    const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';

    const cardContainer = "bg-white dark:bg-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center h-full animate-fade-in-up shadow-md";

    return (
        <div className={cardContainer}>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('dashboard.admin.occupancy')}</h3>
            <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="70%"
                    outerRadius="90%"
                    barSize={20}
                    data={data}
                    startAngle={90}
                    endAngle={-270}
                >
                    <PolarAngleAxis
                        type="number"
                        domain={[0, 100]}
                        angleAxisId={0}
                        tick={false}
                    />
                    <RadialBar
                        background
                        dataKey="value"
                        cornerRadius={10}
                        angleAxisId={0}
                        fill={fill}
                    />
                    <text
                        x="50%"
                        y="50%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-4xl font-bold fill-current"
                        style={{ fill: textColor }}
                    >
                        {`${occupancyRate}%`}
                    </text>
                </RadialBarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default OccupancyRadialChart;
