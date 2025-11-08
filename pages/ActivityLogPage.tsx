import React, { useState, useEffect, useMemo } from 'react';
import { ActivityLog } from '../types';
import { activityLogApi, logActivity } from '../services/apiService';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { useExportSettings } from '../context/ExportSettingsContext';
import { exportToPdf, exportToExcel } from '../services/exportService';
import ExportOptionsModal from '../components/ExportOptionsModal';

type ActionFilter = 'all' | 'logins' | 'creations' | 'updates' | 'deletions';

const ActivityLogPage: React.FC = () => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
    const [userFilter, setUserFilter] = useState<string>('all');
    const { language, t } = useLanguage();
    const { showToast } = useToast();
    const { user } = useAuth();
    const { settings: exportSettings } = useExportSettings();

    // Export states
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    const [isExcelExporting, setIsExcelExporting] = useState(false);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const data = await activityLogApi.getAll();
                // Sort by most recent first
                setLogs(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
            } catch (error) {
                console.error("Failed to fetch activity logs", error);
                showToast(t('errors.fetchFailed'), 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [showToast, t]);
    
    const users = useMemo(() => {
        const allUsers = logs.map(log => log.username);
        return ['all', ...Array.from(new Set(allUsers)).sort()];
    }, [logs]);

    const filteredLogs = useMemo(() => {
        const lowerCaseSearch = searchTerm.toLowerCase();

        return logs.filter(log => {
            // User Filter
            const userMatch = userFilter === 'all' || log.username === userFilter;
            if (!userMatch) return false;

            const lowerCaseAction = log.action.toLowerCase();
            
            // Action Type Filter
            let actionTypeMatch = false;
            if (actionFilter === 'all') {
                actionTypeMatch = true;
            } else if (actionFilter === 'logins') {
                actionTypeMatch = lowerCaseAction.includes('logged in') || lowerCaseAction.includes('logged out') || lowerCaseAction.includes('failed login');
            } else if (actionFilter === 'creations') {
                actionTypeMatch = lowerCaseAction.includes('created') || lowerCaseAction.includes('assigned');
            } else if (actionFilter === 'updates') {
                actionTypeMatch = lowerCaseAction.includes('updated') || lowerCaseAction.includes('set room') || lowerCaseAction.includes('checked out');
            } else if (actionFilter === 'deletions') {
                actionTypeMatch = lowerCaseAction.includes('deleted');
            }
            if (!actionTypeMatch) return false;
            
            // Search Term Filter (now only for action text)
            const searchTermMatch = lowerCaseAction.includes(lowerCaseSearch);
            
            return searchTermMatch;
        });
    }, [logs, searchTerm, actionFilter, userFilter]);

    const handlePdfExport = async () => {
        setIsPdfExporting(true);
        showToast(t('exporting'), 'info');
        try {
            const headers = [t('activityLog.timestamp'), t('activityLog.user'), t('activityLog.action')];
            const data = filteredLogs.map(log => [
                new Date(log.timestamp).toLocaleString(),
                log.username,
                log.action
            ]);
            const filename = `report_activity-log_${new Date().toISOString().split('T')[0]}.pdf`;
            exportToPdf({ headers, data, title: t('activityLog.reportTitle'), filename, settings: exportSettings, language });
            logActivity(user!.username, `Exported Activity Log to PDF`);
        } catch (error) {
            console.error("PDF Export failed:", error);
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsPdfExporting(false);
            setIsExportModalOpen(false);
        }
    };

    const handleExcelExport = async () => {
        setIsExcelExporting(true);
        showToast(t('exporting'), 'info');
        try {
            const headers = [t('activityLog.timestamp'), t('activityLog.user'), t('activityLog.action')];
            const data = filteredLogs.map(log => [
                new Date(log.timestamp).toLocaleString(),
                log.username,
                log.action
            ]);
            const filename = `report_activity-log_${new Date().toISOString().split('T')[0]}.xlsx`;
            exportToExcel({ headers, data, filename, settings: exportSettings });
            logActivity(user!.username, `Exported Activity Log to Excel`);
        } catch (error) {
            console.error("Excel Export failed:", error);
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsExcelExporting(false);
            setIsExportModalOpen(false);
        }
    };

    const isExporting = isPdfExporting || isExcelExporting;

    return (
        <>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">{t('layout.activityLog')}</h1>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md">
                    <div className="p-4 border-b dark:border-slate-700 flex flex-col sm:flex-row gap-4 items-center">
                        <div className="flex flex-col sm:flex-row gap-4 w-full flex-wrap items-center">
                            <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full sm:w-auto p-2.5 dark:bg-slate-700 dark:border-slate-600">
                                {users.map(user => (
                                    <option key={user} value={user}>{user === 'all' ? t('activityLog.allUsers') : user}</option>
                                ))}
                            </select>
                            <input 
                                type="text" 
                                placeholder={t('activityLog.search')} 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full sm:w-80 p-2.5 dark:bg-slate-700 dark:border-slate-600 dark:placeholder-slate-400 dark:text-white"
                            />
                            <div className="flex-grow"></div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsExportModalOpen(true)} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm disabled:opacity-50" disabled={isExporting}>
                                    {isExporting ? <><i className="fas fa-spinner fa-spin me-2"></i>{t('exporting')}</> : <><i className="fas fa-download me-2"></i>{t('export')}</>}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-b dark:border-slate-700 flex flex-col sm:flex-row gap-4 items-center">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse flex-wrap gap-2 sm:gap-0">
                            {(['all', 'logins', 'creations', 'updates', 'deletions'] as ActionFilter[]).map(filter => (
                                <button key={filter} onClick={() => setActionFilter(filter)} className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${actionFilter === filter ? 'bg-primary-600 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>{t(`activityLog.filters.${filter}`)}</button>
                            ))}
                        </div>
                    </div>
                    {loading ? (
                        <div className="p-6 text-center">{t('loading')}...</div>
                    ) : (
                        <div className="relative overflow-x-auto">
                            <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-100 dark:bg-slate-700 dark:text-slate-400">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">{t('activityLog.timestamp')}</th>
                                        <th scope="col" className="px-6 py-3">{t('activityLog.user')}</th>
                                        <th scope="col" className="px-6 py-3">{t('activityLog.action')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.map(log => (
                                        <tr key={log.id} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                            <td className="px-6 py-4">{new Date(log.timestamp).toLocaleString()}</td>
                                            <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">{log.username}</td>
                                            <td className="px-6 py-4">{log.action}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            <ExportOptionsModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                onExportPdf={handlePdfExport}
                onExportExcel={handleExcelExport}
                isPdfExporting={isPdfExporting}
                isExcelExporting={isExcelExporting}
            />
        </>
    );
};

export default ActivityLogPage;