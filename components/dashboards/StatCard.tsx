import React from 'react';
import { useNavigate } from 'react-router-dom';

interface StatCardProps {
    icon: string;
    title: string;
    value: string | number;
    color: string;
    subtitle?: string;
    onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, color, subtitle, onClick }) => {
    const isClickable = !!onClick;
    
    const content = (
        <>
            <div className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-2xl ${color}`}>
                <i className={`fas ${icon}`}></i>
            </div>
            <div className="ms-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
                {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>}
            </div>
            {isClickable && (
                <div className="absolute top-2 right-2 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors">
                    <i className="fas fa-arrow-right"></i>
                </div>
            )}
        </>
    );

    if (isClickable) {
        return (
            <button 
                onClick={onClick}
                className="group relative w-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 flex items-start text-left animate-fade-in-up transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
                {content}
            </button>
        );
    }

    return (
        <div className="relative w-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 flex items-start animate-fade-in-up">
            {content}
        </div>
    );
};

export default StatCard;