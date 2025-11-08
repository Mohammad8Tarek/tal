import React, { useState, useEffect, useMemo } from 'react';
import { MaintenanceRequest, Room } from '../types';
import { maintenanceApi, roomApi, logActivity } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useExportSettings } from '../context/ExportSettingsContext';
import { exportToPdf, exportToExcel } from '../services/exportService';
import ExportOptionsModal from '../components/ExportOptionsModal';

type StatusFilter = 'all' | MaintenanceRequest['status'];

const MaintenancePage: React.FC = () => {
    const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuth();
    const { language, t } = useLanguage();
    const { showToast } = useToast();
    const canManage = user?.roles?.some(r => ['super_admin', 'admin', 'supervisor', 'maintenance'].includes(r));
    const { settings: exportSettings } = useExportSettings();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<MaintenanceRequest | null>(null);
    const [formData, setFormData] = useState({
        roomId: '', problemType: '', description: '', status: 'open' as MaintenanceRequest['status']
    });
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    // Export states
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    const [isExcelExporting, setIsExcelExporting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [requestsData, roomsData] = await Promise.all([ maintenanceApi.getAll(), roomApi.getAll() ]);
            setRequests(requestsData.sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()));
            setRooms(roomsData);
        } catch (error) {
            console.error("Failed to fetch maintenance data", error);
            showToast(t('errors.fetchFailed'), 'error');
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const roomMap = useMemo(() => new Map(rooms.map(r => [r.id, r.roomNumber])), [rooms]);

    const filteredRequests = useMemo(() => {
        if (statusFilter === 'all') return requests;
        return requests.filter(r => r.status === statusFilter);
    }, [requests, statusFilter]);
    
    const openAddModal = () => {
        setEditingRequest(null);
        setFormData({ roomId: '', problemType: '', description: '', status: 'open' });
        setIsModalOpen(true);
    };

    const openEditModal = (request: MaintenanceRequest) => {
        setEditingRequest(request);
        setFormData({ ...request, roomId: String(request.roomId) });
        setIsModalOpen(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const submissionData = { ...formData, roomId: parseInt(formData.roomId, 10) };
        try {
            if (editingRequest) {
                await maintenanceApi.update(editingRequest.id, submissionData);
                logActivity(user!.username, `Updated maintenance request for room ${roomMap.get(submissionData.roomId)}`);
                showToast(t('maintenance.updated'), 'success');
            } else {
                await maintenanceApi.create({ ...submissionData, reportedAt: new Date().toISOString() });
                logActivity(user!.username, `Created maintenance request for room ${roomMap.get(submissionData.roomId)}`);
                showToast(t('maintenance.added'), 'success');
            }
            setIsModalOpen(false);
            await fetchData();
        } catch (error) {
            console.error("Failed to save request", error);
            showToast(t('errors.generic'), 'error');
        } finally { setIsSubmitting(false); }
    };

    const handleDelete = async (request: MaintenanceRequest) => {
        if (!window.confirm(t('maintenance.deleteConfirm'))) return;
        try {
            await maintenanceApi.delete(request.id);
            logActivity(user!.username, `Deleted maintenance request for room ${roomMap.get(request.roomId)}`);
            showToast(t('maintenance.deleted'), 'success');
            await fetchData();
        } catch (error) {
            console.error("Failed to delete request", error);
            showToast(t('errors.generic'), 'error');
        }
    };
    
    const getStatusBadge = (status: MaintenanceRequest['status']) => {
        switch (status) {
            case 'open': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            default: return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
        }
    };
    
    const handlePdfExport = async () => {
        setIsPdfExporting(true);
        showToast(t('exporting'), 'info');
        try {
            const headers = [t('maintenance.room'), t('maintenance.problemType'), t('maintenance.description'), t('maintenance.status'), t('maintenance.reported')];
            const data = filteredRequests.map(req => [
                roomMap.get(req.roomId) || t('unknown'),
                req.problemType,
                req.description,
                t(`statuses.${req.status.replace('_', '')}`),
                new Date(req.reportedAt).toLocaleString()
            ]);
            const filename = `report_maintenance_${new Date().toISOString().split('T')[0]}.pdf`;
            exportToPdf({ headers, data, title: t('maintenance.reportTitle'), filename, settings: exportSettings, language });
            logActivity(user!.username, `Exported maintenance requests to PDF`);
        } catch(error) {
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
            const headers = [t('maintenance.room'), t('maintenance.problemType'), t('maintenance.description'), t('maintenance.status'), t('maintenance.reported')];
            const data = filteredRequests.map(req => [
                roomMap.get(req.roomId) || t('unknown'),
                req.problemType,
                req.description,
                t(`statuses.${req.status.replace('_', '')}`),
                new Date(req.reportedAt).toLocaleString()
            ]);
            const filename = `report_maintenance_${new Date().toISOString().split('T')[0]}.xlsx`;
            exportToExcel({ headers, data, filename, settings: exportSettings });
            logActivity(user!.username, `Exported maintenance requests to Excel`);
        } catch(error) {
            console.error("Excel Export failed:", error);
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsExcelExporting(false);
            setIsExportModalOpen(false);
        }
    };
    
    const formInputClass = "w-full p-2 border border-slate-300 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-200";
    const isExporting = isPdfExporting || isExcelExporting;

    return (
        <>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">{t('maintenance.title')}</h1>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md">
                     <div className="p-4 flex flex-col sm:flex-row justify-between items-center border-b dark:border-slate-700 gap-4">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                            {(['all', 'open', 'in_progress', 'resolved'] as StatusFilter[]).map(status => (
                                <button key={status} onClick={() => setStatusFilter(status)} className={`px-3 py-1 text-sm rounded-full ${statusFilter === status ? 'bg-primary-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>{t(`statuses.${status.replace('_', '')}`)}</button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsExportModalOpen(true)} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm disabled:opacity-50" disabled={isExporting}>
                                {isExporting ? <><i className="fas fa-spinner fa-spin me-2"></i>{t('exporting')}</> : <><i className="fas fa-download me-2"></i>{t('export')}</>}
                            </button>
                            {canManage && <button onClick={openAddModal} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 w-full sm:w-auto"><i className="fas fa-plus me-2"></i>{t('maintenance.newRequest')}</button>}
                        </div>
                    </div>
                    {loading ? (<div className="p-6 text-center">{t('loading')}...</div>) : (
                        <div className="relative overflow-x-auto">
                            <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-100 dark:bg-slate-700 dark:text-slate-400">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">{t('maintenance.room')}</th>
                                        <th scope="col" className="px-6 py-3">{t('maintenance.problem')}</th>
                                        <th scope="col" className="px-6 py-3">{t('maintenance.reported')}</th>
                                        <th scope="col" className="px-6 py-3">{t('maintenance.status')}</th>
                                        {canManage && <th scope="col" className="px-6 py-3">{t('actions')}</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRequests.map(req => (
                                        <tr key={req.id} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                            <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">{roomMap.get(req.roomId) || t('unknown')}</th>
                                            <td className="px-6 py-4">{req.problemType}</td>
                                            <td className="px-6 py-4">{new Date(req.reportedAt).toLocaleString()}</td>
                                            <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(req.status)}`}>{t(`statuses.${req.status.replace('_', '')}`)}</span></td>
                                            {canManage && <td className="px-6 py-4 space-x-4 rtl:space-x-reverse"><button onClick={() => openEditModal(req)} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">{t('edit')}</button><button onClick={() => handleDelete(req)} className="font-medium text-red-600 dark:text-red-500 hover:underline">{t('delete')}</button></td>}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && canManage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h2 className="text-xl font-bold mb-4">{editingRequest ? t('maintenance.editRequest') : t('maintenance.newRequest')}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('maintenance.room')}</label><select name="roomId" value={formData.roomId} onChange={handleFormChange} required className={formInputClass}><option value="" disabled>-- {t('select')} --</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.roomNumber}</option>)}</select></div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('maintenance.problemType')}</label><input type="text" name="problemType" value={formData.problemType} onChange={handleFormChange} required className={formInputClass}/></div>
                            </div>
                            <div className="mb-4"><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('maintenance.description')}</label><textarea name="description" value={formData.description} onChange={handleFormChange} rows={3} className={formInputClass}></textarea></div>
                            {editingRequest && <div className="mb-6"><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('maintenance.status')}</label><select name="status" value={formData.status} onChange={handleFormChange} className={formInputClass}><option value="open">{t('statuses.open')}</option><option value="in_progress">{t('statuses.inprogress')}</option><option value="resolved">{t('statuses.resolved')}</option></select></div>}
                            <div className="flex justify-end gap-4 mt-6"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">{isSubmitting ? `${t('saving')}...` : t('save')}</button></div>
                        </form>
                    </div>
                </div>
            )}

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

export default MaintenancePage;