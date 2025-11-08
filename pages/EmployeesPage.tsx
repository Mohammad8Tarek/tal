import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Employee, DEPARTMENTS, departmentJobTitles, Assignment, Room } from '../types';
import { employeeApi, logActivity, assignmentApi, roomApi } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { translations } from '../services/translations';
import { useExportSettings } from '../context/ExportSettingsContext';
import { exportToPdf, exportToExcel } from '../services/exportService';
import ExportOptionsModal from '../components/ExportOptionsModal';

// Create a mapping from translated department names (and keys) back to their keys
const departmentValueToKeyMap: { [key: string]: string } = {};
for (const key of DEPARTMENTS) {
    const valueEn = translations.en.departments[key as keyof typeof translations.en.departments];
    const valueAr = translations.ar.departments[key as keyof typeof translations.ar.departments];
    if (valueEn) departmentValueToKeyMap[valueEn.toLowerCase()] = key;
    if (valueAr) departmentValueToKeyMap[valueAr.toLowerCase()] = key;
    departmentValueToKeyMap[key.toLowerCase()] = key;
}


const EmployeesPage: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | Employee['status']>('all');
    const [departmentFilter, setDepartmentFilter] = useState<string>('all');
    const { user } = useAuth();
    const { language, t } = useLanguage();
    const { showToast } = useToast();
    const canManage = user?.roles?.some(r => ['super_admin', 'admin', 'hr'].includes(r));
    const { settings: exportSettings } = useExportSettings();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [formData, setFormData] = useState({
        employeeId: '', firstName: '', lastName: '', nationalId: '', jobTitle: '', phone: '', department: '', status: 'active' as Employee['status'], contractEndDate: '',
    });
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importResults, setImportResults] = useState<{ valid: Omit<Employee, 'id'>[], errors: { row: number, data: any, error: string }[] }>({ valid: [], errors: [] });

    // Export states
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    const [isExcelExporting, setIsExcelExporting] = useState(false);
    
    // Bulk action states
    const [selectedEmployees, setSelectedEmployees] = useState<Set<number>>(new Set());
    const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
    const [bulkStatus, setBulkStatus] = useState<Employee['status']>('active');


    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const [data, assignmentsData, roomsData] = await Promise.all([
                employeeApi.getAll(),
                assignmentApi.getAll(),
                roomApi.getAll()
            ]);
            setEmployees(data);
            setAssignments(assignmentsData);
            setRooms(roomsData);
        } catch (error) {
            console.error("Failed to fetch employees", error);
            showToast(t('errors.fetchFailed'), 'error');
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchEmployees(); }, []);
    
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const fullName = `${emp.firstName} ${emp.lastName}`;
            const matchesSearch = fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  emp.nationalId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (emp.employeeId && emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
            const matchesDepartment = departmentFilter === 'all' || emp.department === departmentFilter;
            return matchesSearch && matchesStatus && matchesDepartment;
        });
    }, [employees, searchTerm, statusFilter, departmentFilter]);
    
    // Clear selection when filters change
    useEffect(() => {
        setSelectedEmployees(new Set());
    }, [searchTerm, statusFilter, departmentFilter]);


    const openAddModal = () => {
        const firstDepartment = DEPARTMENTS[0];
        const firstJobTitle = departmentJobTitles[firstDepartment][0];
        setEditingEmployee(null);
        setFormData({ 
            employeeId: '',
            firstName: '',
            lastName: '',
            nationalId: '', 
            jobTitle: firstJobTitle, 
            phone: '', 
            department: firstDepartment, 
            status: 'active', 
            contractEndDate: new Date().toISOString().split('T')[0] 
        });
        setIsModalOpen(true);
    };

    const openEditModal = (employee: Employee) => {
        setEditingEmployee(employee);
        setFormData({ ...employee, contractEndDate: employee.contractEndDate.split('T')[0] });
        setIsModalOpen(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'department') {
            const newJobTitle = departmentJobTitles[value]?.[0] || '';
            setFormData(prev => ({ ...prev, department: value, jobTitle: newJobTitle }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const isDuplicateNatId = employees.some(emp => emp.nationalId.trim() === formData.nationalId.trim() && emp.id !== editingEmployee?.id);
        if (isDuplicateNatId) {
            showToast(t('errors.duplicateNationalId', { nationalId: formData.nationalId }), 'error');
            return;
        }
        const isDuplicateEmpId = employees.some(emp => emp.employeeId.trim() === formData.employeeId.trim() && emp.id !== editingEmployee?.id);
        if (isDuplicateEmpId) {
            showToast(t('errors.duplicateEmployeeId', { employeeId: formData.employeeId }), 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            const submissionData = { ...formData, contractEndDate: new Date(formData.contractEndDate).toISOString() };
            const fullName = `${formData.firstName} ${formData.lastName}`;
            if (editingEmployee) {
                await employeeApi.update(editingEmployee.id, submissionData);
                logActivity(user!.username, `Updated employee: ${fullName}`);
                showToast(t('employees.updated'), 'success');
            } else {
                await employeeApi.create(submissionData);
                logActivity(user!.username, `Created employee: ${fullName}`);
                showToast(t('employees.added'), 'success');
            }
            setIsModalOpen(false);
            await fetchEmployees();
        } catch (error) {
            console.error("Failed to save employee", error);
            showToast(t('errors.generic'), 'error');
        } finally { setIsSubmitting(false); }
    };
    
    const handleDelete = async (employee: Employee) => {
        if (!window.confirm(t('employees.deleteConfirm'))) return;
        setIsSubmitting(true);
        try {
            await employeeApi.delete(employee.id);
            logActivity(user!.username, `Deleted employee: ${employee.firstName} ${employee.lastName}`);
            showToast(t('employees.deleted'), 'success');
            await fetchEmployees();
        } catch (error: any) {
            showToast(t('errors.generic'), 'error');
        } finally { 
            // FIX: The state variable `isSubmitting` was being called as a function. It should be updated using its setter `setIsSubmitting`.
            setIsSubmitting(false); 
        }
    };

    const getStatusBadge = (status: Employee['status']) => {
        return status === 'active' 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    };

    const handlePdfExport = async () => {
        setIsPdfExporting(true);
        showToast(t('exporting'), 'info');
        try {
            const headers = [t('employees.firstName'), t('employees.lastName'), t('employees.employeeId'), t('employees.nationalId'), t('employees.department'), t('employees.jobTitle'), t('employees.phone'), t('employees.status'), t('employees.contractEndDate')];
            const data = filteredEmployees.map(emp => [
                emp.firstName,
                emp.lastName,
                emp.employeeId,
                emp.nationalId,
                t(`departments.${emp.department}`),
                emp.jobTitle,
                emp.phone,
                t(`statuses.${emp.status}`),
                new Date(emp.contractEndDate).toLocaleDateString()
            ]);
            const filename = `report_employees_${new Date().toISOString().split('T')[0]}.pdf`;
            exportToPdf({ headers, data, title: t('employees.reportTitle'), filename, settings: exportSettings, language });
            logActivity(user!.username, `Exported employees to PDF`);
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
            const headers = [t('employees.firstName'), t('employees.lastName'), t('employees.employeeId'), t('employees.nationalId'), t('employees.department'), t('employees.jobTitle'), t('employees.phone'), t('employees.status'), t('employees.contractEndDate')];
            const data = filteredEmployees.map(emp => [
                emp.firstName,
                emp.lastName,
                emp.employeeId,
                emp.nationalId,
                t(`departments.${emp.department}`),
                emp.jobTitle,
                emp.phone,
                t(`statuses.${emp.status}`),
                new Date(emp.contractEndDate).toLocaleDateString()
            ]);
            const filename = `report_employees_${new Date().toISOString().split('T')[0]}.xlsx`;
            exportToExcel({ headers, data, filename, settings: exportSettings });
            logActivity(user!.username, `Exported employees to Excel`);
        } catch (error) {
            console.error("Excel Export failed:", error);
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsExcelExporting(false);
            setIsExportModalOpen(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsSubmitting(true);
        showToast(t('loading') + '...', 'info');
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);
                processImportedData(json);
            } catch (err) {
                showToast(t('errors.generic'), 'error');
            } finally {
                setIsSubmitting(false);
                if(fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.onerror = () => { showToast(t('errors.generic'), 'error'); setIsSubmitting(false); }
        reader.readAsBinaryString(file);
    };
    
    const processImportedData = (data: any[]) => {
        const validRows: Omit<Employee, 'id'>[] = [];
        const errorRows: { row: number, data: any, error: string }[] = [];
        const existingNationalIds = new Set(employees.map(e => e.nationalId));
        const existingEmployeeIds = new Set(employees.map(e => e.employeeId));
        const fileNationalIds = new Set<string>();
        const fileEmployeeIds = new Set<string>();

        const headerKeyMapping: { [key: string]: string } = {
            'full name': 'fullName', 'الاسم الكامل': 'fullName',
            'first name': 'firstName', 'الاسم الأول': 'firstName',
            'last name': 'lastName', 'الاسم الأخير': 'lastName',
            'employee id': 'employeeId', 'الرقم الوظيفي': 'employeeId',
            'job title': 'jobTitle', 'المسمى الوظيفي': 'jobTitle',
            'national id': 'nationalId', 'الرقم الوطني': 'nationalId',
            'phone': 'phone', 'phone number': 'phone', 'رقم الهاتف': 'phone',
            'department': 'department', 'القسم': 'department',
            'status': 'status', 'الحالة': 'status',
            'contract end date': 'contractEndDate', 'تاريخ انتهاء العقد': 'contractEndDate',
        };

        if(data.length === 0){ showToast(t('errors.generic'), 'error'); return; }

        const fileHeaders = Object.keys(data[0] || {});
        const mappedHeaders: { [originalHeader: string]: string } = {};
        fileHeaders.forEach(h => {
            const mappedKey = headerKeyMapping[h.trim().toLowerCase()];
            if (mappedKey) mappedHeaders[h] = mappedKey;
        });

        const presentFields = new Set(Object.values(mappedHeaders));
        const requiredFields = ['employeeId', 'nationalId', 'department', 'status', 'contractEndDate', 'jobTitle'];
        const missingField = requiredFields.find(f => !presentFields.has(f));
        if (missingField) {
            const headerName = t(`employees.${missingField as keyof typeof translations.en.employees}`);
            showToast(t('employees.import.error.missingHeader', { header: headerName }), 'error');
            return;
        }
        if (!presentFields.has('fullName') && (!presentFields.has('firstName'))) {
            showToast(t('employees.import.error.missingHeader', { header: `${t('employees.fullName')} or ${t('employees.firstName')}` }), 'error');
            return;
        }

        data.forEach((rawRow, index) => {
            const rowNumber = index + 2;
            let error = '';
            const row: { [key: string]: any } = {};
            for (const header in rawRow) if (mappedHeaders[header]) row[mappedHeaders[header]] = rawRow[header];

            let firstName = row.firstName;
            let lastName = row.lastName;
            if (row.fullName && !firstName && !lastName) {
                const parts = String(row.fullName).trim().split(' ');
                firstName = parts[0] || '';
                lastName = parts.slice(1).join(' ');
            }

            if (!firstName) error = t('employees.import.error.missingValue', { field: t('employees.firstName') });
            else if (!row.employeeId) error = t('employees.import.error.missingValue', { field: t('employees.employeeId') });
            else if (!row.nationalId) error = t('employees.import.error.missingValue', { field: t('employees.nationalId') });
            else {
                const nationalIdStr = String(row.nationalId).trim();
                const employeeIdStr = String(row.employeeId).trim();
                if (existingNationalIds.has(nationalIdStr) || fileNationalIds.has(nationalIdStr)) error = t('errors.duplicateNationalId', { nationalId: nationalIdStr });
                if (!error && (existingEmployeeIds.has(employeeIdStr) || fileEmployeeIds.has(employeeIdStr))) error = t('errors.duplicateEmployeeId', { employeeId: employeeIdStr });
            }
            
            const departmentKey = !error ? departmentValueToKeyMap[String(row.department || '').trim().toLowerCase()] : null;
            if (!error && !departmentKey) error = t('employees.import.error.invalidDepartment', { value: String(row.department) });
            
            const statusValueRaw = String(row.status || '').toLowerCase().trim();
            const statusKey = statusValueRaw === 'active' || statusValueRaw === translations.ar.statuses.active.toLowerCase() ? 'active' : (statusValueRaw === 'left' || statusValueRaw === translations.ar.statuses.left.toLowerCase() ? 'left' : null);
            if (!error && !statusKey) error = t('employees.import.error.invalidStatus', { value: String(row.status) });

            if (!error && !(row.contractEndDate instanceof Date && !isNaN(row.contractEndDate.getTime()))) error = t('employees.import.error.invalidDate');
            if (error) {
                errorRows.push({ row: rowNumber, data: rawRow, error });
            } else {
                fileNationalIds.add(String(row.nationalId).trim());
                fileEmployeeIds.add(String(row.employeeId).trim());
                validRows.push({
                    employeeId: String(row.employeeId).trim(),
                    firstName: String(firstName),
                    lastName: String(lastName || ''),
                    nationalId: String(row.nationalId).trim(),
                    jobTitle: String(row.jobTitle),
                    phone: String(row.phone || ''),
                    department: departmentKey!,
                    status: statusKey as Employee['status'],
                    contractEndDate: (row.contractEndDate as Date).toISOString(),
                });
            }
        });
        setImportResults({ valid: validRows, errors: errorRows });
        setIsImportModalOpen(true);
    };

    const handleConfirmImport = async () => {
        setIsSubmitting(true);
        const results = await Promise.allSettled(
            importResults.valid.map(emp => employeeApi.create(emp).then(newEmp => logActivity(user!.username, `Imported employee: ${newEmp.firstName} ${newEmp.lastName}`)))
        );
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const totalCount = importResults.valid.length;
        if (successCount > 0) showToast(t('employees.import.success', { successCount }), 'success');
        if (successCount < totalCount) showToast(t('employees.import.partialSuccess', { successCount, totalCount, errorCount: totalCount - successCount }), 'error');
        setIsImportModalOpen(false);
        setImportResults({ valid: [], errors: [] });
        await fetchEmployees();
        setIsSubmitting(false);
    };
    
    // --- Bulk Action Handlers ---
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = new Set(filteredEmployees.map((emp: Employee) => emp.id));
            setSelectedEmployees(allIds);
        } else {
            setSelectedEmployees(new Set());
        }
    };

    const handleSelectEmployee = (employeeId: number) => {
        const newSelection = new Set(selectedEmployees);
        if (newSelection.has(employeeId)) {
            newSelection.delete(employeeId);
        } else {
            newSelection.add(employeeId);
        }
        setSelectedEmployees(newSelection);
    };
    
    const handleConfirmBulkStatusChange = async () => {
        setIsSubmitting(true);
        const employeesToUpdate = Array.from(selectedEmployees).map(id => employees.find(e => e.id === id)).filter(Boolean) as Employee[];

        try {
            // Update employee statuses
            const updatePromises = employeesToUpdate.map(emp => employeeApi.update(emp.id, { status: bulkStatus }));
            await Promise.all(updatePromises);
            
            // If status is 'left', check them out
            if (bulkStatus === 'left') {
                const checkoutPromises: Promise<any>[] = [];
                employeesToUpdate.forEach(emp => {
                    const assignment = assignments.find(a => a.employeeId === emp.id && !a.checkOutDate);
                    if (assignment) {
                        checkoutPromises.push(assignmentApi.update(assignment.id, { checkOutDate: new Date().toISOString() }));
                        const room = rooms.find(r => r.id === assignment.roomId);
                        if (room && room.currentOccupancy > 0) {
                            checkoutPromises.push(roomApi.update(room.id, { currentOccupancy: room.currentOccupancy - 1, status: 'available' }));
                        }
                    }
                });
                await Promise.all(checkoutPromises);
            }
            
            logActivity(user!.username, `Bulk updated status to ${bulkStatus} for ${employeesToUpdate.length} employees.`);
            showToast(t('employees.bulkStatusUpdated', { count: employeesToUpdate.length }), 'success');
            
            await fetchEmployees();
            setSelectedEmployees(new Set());
        } catch (error) {
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsSubmitting(false);
            setIsBulkStatusModalOpen(false);
        }
    };
    
    const numSelected = selectedEmployees.size;
    const numTotalOnPage = filteredEmployees.length;
    const isAllSelected = numTotalOnPage > 0 && numSelected === numTotalOnPage;
    const isIndeterminate = numSelected > 0 && numSelected < numTotalOnPage;
    
    const formInputClass = "w-full p-2 border border-slate-300 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-200";
    const isExporting = isPdfExporting || isExcelExporting;

    return (
        <>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">{t('employees.title')}</h1>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md">
                    <div className="p-4 border-b dark:border-slate-700 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <input type="text" placeholder={t('employees.search')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-slate-700 dark:border-slate-600 md:col-span-2"/>
                            <div>
                                <label htmlFor="status-filter" className="sr-only">{t('employees.status')}</label>
                                <select id="status-filter" aria-label={t('employees.status')} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-slate-700 dark:border-slate-600">
                                    <option value="all">{t('employees.allStatuses')}</option>
                                    <option value="active">{t('statuses.active')}</option>
                                    <option value="left">{t('statuses.left')}</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="department-filter" className="sr-only">{t('employees.department')}</label>
                                <select id="department-filter" aria-label={t('employees.department')} value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-slate-700 dark:border-slate-600">
                                    <option value="all">{t('employees.allDepartments')}</option>
                                    {DEPARTMENTS.map(dept => (
                                        <option key={dept} value={dept}>{t(`departments.${dept}`)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                         <div className="flex justify-end items-center gap-2">
                            <button onClick={() => setIsExportModalOpen(true)} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm disabled:opacity-50" disabled={isExporting}>
                                {isExporting ? <><i className="fas fa-spinner fa-spin me-2"></i>{t('exporting')}</> : <><i className="fas fa-download me-2"></i>{t('export')}</>}
                            </button>
                            {canManage && <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm" disabled={isSubmitting}><i className="fas fa-file-import me-2"></i>{t('importExcel')}</button>}
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".xlsx, .xls" />
                            {canManage && <button onClick={openAddModal} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"><i className="fas fa-plus me-2"></i>{t('employees.add')}</button>}
                        </div>
                    </div>
                    
                    {numSelected > 0 && canManage && (
                        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border-b dark:border-slate-700 flex items-center gap-4">
                            <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">{t('employees.employeesSelected', { count: numSelected })}</span>
                            <button onClick={() => setIsBulkStatusModalOpen(true)} className="px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">{t('employees.changeStatus')}</button>
                        </div>
                    )}

                    {loading ? (<div className="p-6 text-center">{t('loading')}...</div>) : (
                        <div className="relative overflow-x-auto">
                            <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-100 dark:bg-slate-700 dark:text-slate-400">
                                    <tr>
                                        {canManage && <th scope="col" className="p-4"><input type="checkbox" ref={el => { if (el) { el.indeterminate = isIndeterminate; } }} checked={isAllSelected} onChange={handleSelectAll} className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600" aria-label={t('employees.selectAll')} /></th>}
                                        <th scope="col" className="px-6 py-3">{t('employees.firstName')}</th>
                                        <th scope="col" className="px-6 py-3">{t('employees.lastName')}</th>
                                        <th scope="col" className="px-6 py-3">{t('employees.employeeId')}</th>
                                        <th scope="col" className="px-6 py-3">{t('employees.nationalId')}</th>
                                        <th scope="col" className="px-6 py-3">{t('employees.department')}</th>
                                        <th scope="col" className="px-6 py-3">{t('employees.jobTitle')}</th>
                                        <th scope="col" className="px-6 py-3">{t('employees.status')}</th>
                                        {canManage && <th scope="col" className="px-6 py-3">{t('actions')}</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEmployees.map(emp => (
                                        <tr key={emp.id} className={`border-b dark:border-slate-700 ${selectedEmployees.has(emp.id) ? 'bg-primary-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                                            {canManage && <td className="p-4"><input type="checkbox" checked={selectedEmployees.has(emp.id)} onChange={() => handleSelectEmployee(emp.id)} className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600" aria-label={t('employees.selectEmployee', { name: `${emp.firstName} ${emp.lastName}` })} /></td>}
                                            <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">{emp.firstName}</th>
                                            <td className="px-6 py-4">{emp.lastName}</td>
                                            <td className="px-6 py-4">{emp.employeeId}</td>
                                            <td className="px-6 py-4">{emp.nationalId}</td>
                                            <td className="px-6 py-4">{t(`departments.${emp.department}`)}</td>
                                            <td className="px-6 py-4">{emp.jobTitle}</td>
                                            <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(emp.status)}`}>{t(`statuses.${emp.status}`)}</span></td>
                                            {canManage && (
                                                <td className="px-6 py-4 space-x-4 rtl:space-x-reverse">
                                                    <button onClick={() => openEditModal(emp)} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">{t('edit')}</button>
                                                    {user?.roles?.includes('admin') && (
                                                        <button onClick={() => handleDelete(emp)} className="font-medium text-red-600 dark:text-red-500 hover:underline">{t('delete')}</button>
                                                    )}
                                                </td>
                                            )}
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
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl">
                        <h2 className="text-xl font-bold mb-4">{editingEmployee ? t('employees.edit') : t('employees.add')}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.firstName')}</label><input type="text" name="firstName" value={formData.firstName} onChange={handleFormChange} required className={formInputClass}/></div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.lastName')}</label><input type="text" name="lastName" value={formData.lastName} onChange={handleFormChange} required className={formInputClass}/></div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.phone')}</label><input type="text" name="phone" value={formData.phone} onChange={handleFormChange} required className={formInputClass}/></div>

                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.employeeId')}</label><input type="text" name="employeeId" value={formData.employeeId} onChange={handleFormChange} required className={formInputClass}/></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.nationalId')}</label><input type="text" name="nationalId" value={formData.nationalId} onChange={handleFormChange} required className={formInputClass}/></div>
                                
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.department')}</label>
                                    <select name="department" value={formData.department} onChange={handleFormChange} required className={formInputClass}>
                                        {DEPARTMENTS.map(dept => (
                                            <option key={dept} value={dept}>{t(`departments.${dept}`)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.jobTitle')}</label>
                                    <select name="jobTitle" value={formData.jobTitle} onChange={handleFormChange} required className={formInputClass}>
                                        {departmentJobTitles[formData.department]?.map(title => (
                                            <option key={title} value={title}>{title}</option>
                                        ))}
                                        {editingEmployee && formData.jobTitle && !departmentJobTitles[formData.department]?.includes(formData.jobTitle) && (
                                            <option key={formData.jobTitle} value={formData.jobTitle}>{formData.jobTitle}</option>
                                        )}
                                    </select>
                                </div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.contractEndDate')}</label><input type="date" name="contractEndDate" value={formData.contractEndDate} onChange={handleFormChange} required className={formInputClass}/></div>
                                {editingEmployee && (<div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.status')}</label><select name="status" value={formData.status} onChange={handleFormChange} className={formInputClass}><option value="active">{t('statuses.active')}</option><option value="left">{t('statuses.left')}</option></select></div>)}
                            </div>
                            <div className="flex justify-end gap-4 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">{isSubmitting ? `${t('saving')}...` : t('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">{t('employees.import.title')}</h2>
                        <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-md mb-4">
                            <h3 className="font-semibold text-lg mb-2 text-slate-800 dark:text-slate-200">{t('employees.import.summary')}</h3>
                            <p className="text-green-600 dark:text-green-400">{t('employees.import.valid', { count: importResults.valid.length })}</p>
                            <p className="text-red-600 dark:text-red-400">{t('employees.import.errors', { count: importResults.errors.length })}</p>
                        </div>
                        
                        {importResults.errors.length > 0 && (
                            <div className="mb-4">
                                <h3 className="font-semibold mb-2 text-slate-800 dark:text-slate-200">{t('employees.import.errorList')}</h3>
                                <div className="max-h-60 overflow-y-auto border dark:border-slate-600 rounded-md p-2 text-sm space-y-2">
                                    {importResults.errors.map((e, i) => (
                                        <div key={i} className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                            <p className="font-bold text-red-800 dark:text-red-300">{t('employees.import.row', { row: e.row })}: <span className="font-normal">{e.error}</span></p>
                                            <pre className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">{JSON.stringify(e.data)}</pre>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-4 mt-6">
                            <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button>
                            <button onClick={handleConfirmImport} disabled={isSubmitting || importResults.valid.length === 0} className="px-4 py-2 bg-primary-600 text-white rounded disabled:opacity-50">{isSubmitting ? `${t('saving')}...` : t('employees.import.confirmButton')}</button>
                        </div>
                        {importResults.valid.length === 0 && <p className="text-sm text-center mt-4 text-slate-500">{t('employees.import.noValidData')}</p>}
                    </div>
                </div>
            )}

            {isBulkStatusModalOpen && canManage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{t('employees.bulkStatusModalTitle')}</h2>
                        <p className="mb-4 text-slate-600 dark:text-slate-400">{t('employees.confirmBulkStatusChange', { count: selectedEmployees.size, status: t(`statuses.${bulkStatus}`) })}</p>
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.newStatus')}</label>
                            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as any)} className={formInputClass}>
                                <option value="active">{t('statuses.active')}</option>
                                <option value="left">{t('statuses.left')}</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-4">
                            <button type="button" onClick={() => setIsBulkStatusModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button>
                            <button onClick={handleConfirmBulkStatusChange} disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">{isSubmitting ? `${t('saving')}...` : t('save')}</button>
                        </div>
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

export default EmployeesPage;