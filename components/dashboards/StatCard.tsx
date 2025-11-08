import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface StatCardProps {
    icon: string;
    title: string;
    value: string | number;
    gradient: string;
    onClick?: () => void;
    trendData?: number[];
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, gradient, onClick, trendData }) => {
    const isClickable = !!onClick;
    const trendChartData = trendData ? trendData.map((v, i) => ({ name: `p${i}`, value: v })) : [];

    const content = (
        <>
            <div className="flex justify-between items-start">
                <div className={`w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-2xl ${gradient} shadow-lg`}>
                    <i className={`fas ${icon}`}></i>
                </div>
                {isClickable && (
                    <div className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors">
                        <i className="fas fa-arrow-right"></i>
                    </div>
                )}
            </div>
            <div className="mt-auto">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</p>
                <div className="flex items-end justify-between">
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
                    {trendData && trendData.length > 0 && (
                        <div className="w-24 h-10 -mb-2 -mr-2">
                             <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendChartData}>
                                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    const neumorphicClasses = "group relative w-full flex flex-col bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 animate-fade-in-up transition-all duration-300 shadow-[5px_5px_10px_#d1d9e6,-5px_-5px_10px_#ffffff] dark:shadow-[5px_5px_10px_#1e293b,-5px_-5px_10px_#334155]";
    const hoverClasses = isClickable ? "hover:shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] dark:hover:shadow-[2px_2px_5px_#1e293b,-2px_-2px_5px_#334155] hover:-translate-y-0.5" : "";


    if (isClickable) {
        return (
            <button
                onClick={onClick}
                className={`${neumorphicClasses} ${hoverClasses} text-left`}
            >
                {content}
            </button>
        );
    }

    return (
        <div className={`${neumorphicClasses}`}>
            {content}
        </div>
    );
};

export default StatCard;
