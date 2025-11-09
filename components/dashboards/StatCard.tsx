import React from 'react';

interface StatCardProps {
    icon: string;
    title: string;
    value: string | number;
    gradient: string;
    onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, gradient, onClick }) => {
    const isClickable = !!onClick;

    const cardClasses = `
        bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-md 
        flex items-center gap-5 animate-fade-in-up w-full
        ${isClickable ? 'cursor-pointer hover:shadow-lg transition-shadow duration-300' : ''}
    `;

    const content = (
        <>
            <div className={`w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center text-white text-3xl ${gradient} shadow-lg`}>
                <i className={`fas ${icon}`}></i>
            </div>
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-md font-medium truncate">{title}</p>
                <p className="text-slate-900 dark:text-white text-4xl font-bold">{value}</p>
            </div>
        </>
    );

    if (isClickable) {
        return (
            <button onClick={onClick} className={cardClasses + ' text-left'}>
                {content}
            </button>
        );
    }

    return (
        <div className={cardClasses}>
            {content}
        </div>
    );
};

export default StatCard;
