import React, { useState, useEffect, useMemo } from 'react';
import { Assignment, Employee, Room, Building, Floor, Reservation, DEPARTMENTS, departmentJobTitles, ReservationGuest, Hosting } from '../types';
import { assignmentApi, employeeApi, roomApi, buildingApi, floorApi, logActivity, reservationApi, hostingApi } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useExportSettings } from '../context/ExportSettingsContext';
import { exportToPdf, exportToExcel } from '../services/exportService';
import ExportOptionsModal from '../components/ExportOptionsModal';

const toDatetimeLocal = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
};

const ReservationsPage: React.FC = () => {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [hostings, setHostings] = useState<Hosting[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [floors, setFloors] = useState<Floor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuth();
    const { language, t } = useLanguage();
    const { showToast } = useToast();
    const canManage = user?.roles?.some(r => ['super_admin', 'admin', 'manager', 'supervisor'].includes(r));
    const [activeTab, setActiveTab] = useState<'assignments' | 'reservations' | 'hosting'>('assignments');
    const { settings: exportSettings } = useExportSettings();

    // Export states
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    const [isExcelExporting, setIsExcelExporting] = useState(false);

    // Modal States
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [assignmentFormData, setAssignmentFormData] = useState({ 
        employeeId: '', 
        roomId: '', 
        checkInDate: toDatetimeLocal(new Date().toISOString()),
        expectedCheckOutDate: '',
    });
    
    const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
    const [reservationFormData, setReservationFormData] = useState({ 
        guests: [{ firstName: '', lastName: '', guestIdCardNumber: '', guestPhone: '' }] as ReservationGuest[],
        roomId: '', 
        checkInDate: toDatetimeLocal(new Date().toISOString()), 
        checkOutDate: '',
        notes: '',
        jobTitle: departmentJobTitles[DEPARTMENTS[0]][0],
        department: DEPARTMENTS[0],
    });

    const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
    const [assignmentToCheckOut, setAssignmentToCheckOut] = useState<Assignment | null>(null);
    const [checkOutDate, setCheckOutDate] = useState(toDatetimeLocal(new Date().toISOString()));
    
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [reservationToAssign, setReservationToAssign] = useState<Reservation | null>(null);
    const [selectedEmployeeForReservation, setSelectedEmployeeForReservation] = useState('');

    const [isHostingModalOpen, setIsHostingModalOpen] = useState(false);
    const [hostingFormData, setHostingFormData] = useState({
        employeeId: '',
        guests: [{ firstName: '', lastName: '', guestIdCardNumber: '', guestPhone: '' }] as ReservationGuest[],
        startDate: toDatetimeLocal(new Date().toISOString()),
        endDate: '',
        notes: '',
    });


    const fetchData = async () => {
        setLoading(true);
        try {
            const [assignData, reservData, hostData, empData, roomData, buildingData, floorData] = await Promise.all([
                assignmentApi.getAll(), reservationApi.getAll(), hostingApi.getAll(), employeeApi.getAll(), roomApi.getAll(), buildingApi.getAll(), floorApi.getAll()
            ]);
            setAssignments(assignData.sort((a,b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime()));
            setReservations(reservData.sort((a,b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()));
            setHostings(hostData.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
            setEmployees(empData);
            setRooms(roomData);
            setBuildings(buildingData);
            setFloors(floorData);
        } catch (error) {
            showToast(t('errors.fetchFailed'), 'error');
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [showToast]);

    // --- Memos for performance ---
    const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
    const roomMap = useMemo(() => new Map(rooms.map(r => [r.id, r.roomNumber])), [rooms]);
    const getRoomBuildingName = (roomId: number) => {
        const room = rooms.find(r => r.id === roomId);
        if (!room) return '';
        const floor = floors.find(f => f.id === room.floorId);
        if (!floor) return '';
        const building = buildings.find(b => b.id === floor.buildingId);
        return building ? building.name : '';
    };
    const availableEmployees = useMemo(() => {
        const assignedIds = new Set(assignments.filter(a => !a.checkOutDate).map(a => a.employeeId));
        return employees.filter(e => e.status === 'active' && !assignedIds.has(e.id));
    }, [employees, assignments]);
    const availableRooms = useMemo(() => rooms.filter(r => r.currentOccupancy < r.capacity && r.status !== 'maintenance' && r.status !== 'reserved'), [rooms]);
    const housedEmployees = useMemo(() => {
        const housedEmployeeIds = new Set(assignments.filter(a => !a.checkOutDate).map(a => a.employeeId));
        return employees.filter(e => housedEmployeeIds.has(e.id));
    }, [employees, assignments]);
    const employeeRoomMap = useMemo(() => {
        const map = new Map<number, number>();
        assignments.filter(a => !a.checkOutDate).forEach(a => map.set(a.employeeId, a.roomId));
        return map;
    }, [assignments]);


    // --- Assignment Actions ---
    const openNewAssignmentModal = () => {
        setAssignmentFormData({ 
            employeeId: '', 
            roomId: '', 
            checkInDate: toDatetimeLocal(new Date().toISOString()),
            expectedCheckOutDate: '',
        });
        setIsAssignmentModalOpen(true);
    };
    
    const handleAssignmentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const { employeeId, roomId, checkInDate, expectedCheckOutDate } = assignmentFormData;
        if (!employeeId || !roomId || !checkInDate) {
            showToast(t('reservations.formError'), 'error');
            setIsSubmitting(false);
            return;
        }
        try {
            const assignmentData = {
                employeeId: parseInt(employeeId, 10),
                roomId: parseInt(roomId, 10),
                checkInDate: new Date(checkInDate).toISOString(),
                expectedCheckOutDate: expectedCheckOutDate ? new Date(expectedCheckOutDate).toISOString() : null,
                checkOutDate: null,
            };
            await assignmentApi.create(assignmentData);
            const room = rooms.find(r => r.id === assignmentData.roomId);
            if(room) await roomApi.update(room.id, { currentOccupancy: room.currentOccupancy + 1, status: room.currentOccupancy + 1 >= room.capacity ? 'occupied' : room.status });
            const employee = employeeMap.get(assignmentData.employeeId);
            logActivity(user!.username, `Assigned employee ${employee?.firstName} ${employee?.lastName} to room ${roomMap.get(assignmentData.roomId)}`);
            showToast(t('reservations.added'), 'success');
            setIsAssignmentModalOpen(false);
            await fetchData();
        } catch (error) {
            showToast(t('errors.generic'), 'error');
        } finally { setIsSubmitting(false); }
    };
    
    const openCheckOutModal = (assignment: Assignment) => {
        setAssignmentToCheckOut(assignment);
        setCheckOutDate(toDatetimeLocal(new Date().toISOString()));
        setIsCheckOutModalOpen(true);
    };

    const handleConfirmCheckOut = async () => {
        if (!assignmentToCheckOut) return;
        setIsSubmitting(true);
        try {
            await assignmentApi.update(assignmentToCheckOut.id, { checkOutDate: new Date(checkOutDate).toISOString() });
            const room = rooms.find(r => r.id === assignmentToCheckOut.roomId);
            if(room) {
                const newOccupancy = room.currentOccupancy > 0 ? room.currentOccupancy - 1 : 0;
                await roomApi.update(room.id, { currentOccupancy: newOccupancy, status: newOccupancy === 0 ? 'available' : room.status });
            }
            const employee = employeeMap.get(assignmentToCheckOut.employeeId);
            logActivity(user!.username, `Checked out employee: ${employee?.firstName} ${employee?.lastName}`);
            showToast(t('reservations.checkedOut'), 'success');
        } catch(error) {
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsCheckOutModalOpen(false);
            setAssignmentToCheckOut(null);
            setIsSubmitting(false);
            await fetchData();
        }
    };
    
    // --- Reservation Actions ---
    const openNewReservationModal = () => {
        const firstDepartment = DEPARTMENTS[0];
        const firstJobTitle = departmentJobTitles[firstDepartment][0];
        setReservationFormData({ 
            guests: [{ firstName: '', lastName: '', guestIdCardNumber: '', guestPhone: '' }],
            roomId: '', 
            checkInDate: toDatetimeLocal(new Date().toISOString()), 
            checkOutDate: '',
            notes: '',
            jobTitle: firstJobTitle,
            department: firstDepartment,
        });
        setIsReservationModalOpen(true);
    };

    const handleReservationFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'department') {
            const newJobTitle = departmentJobTitles[value]?.[0] || '';
            setReservationFormData(prev => ({ ...prev, department: value, jobTitle: newJobTitle }));
        } else {
            setReservationFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleGuestChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newGuests = [...reservationFormData.guests];
        newGuests[index] = { ...newGuests[index], [name]: value };
        setReservationFormData(prev => ({ ...prev, guests: newGuests }));
    };

    const handleAddGuest = () => {
        setReservationFormData(prev => ({
            ...prev,
            guests: [...prev.guests, { firstName: '', lastName: '', guestIdCardNumber: '', guestPhone: '' }]
        }));
    };

    const handleRemoveGuest = (index: number) => {
        const newGuests = reservationFormData.guests.filter((_, i) => i !== index);
        setReservationFormData(prev => ({ ...prev, guests: newGuests }));
    };

    const handleReservationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const { guests, roomId, checkInDate, ...rest } = reservationFormData;
        const primaryGuest = guests[0];
        
        if (!primaryGuest || !primaryGuest.firstName || !roomId || !checkInDate || !primaryGuest.guestIdCardNumber || !primaryGuest.guestPhone) {
            showToast(t('reservations.resFormError'), 'error');
            setIsSubmitting(false); return;
        }
        
        const room = rooms.find(r => r.id === parseInt(roomId, 10));
        if (room && guests.length > (room.capacity - room.currentOccupancy)) {
             showToast(t('errors.roomCapacityExceeded'), 'error');
             setIsSubmitting(false); return;
        }

        try {
            await reservationApi.create({
                ...rest,
                roomId: parseInt(roomId, 10),
                checkInDate: new Date(checkInDate).toISOString(),
                checkOutDate: rest.checkOutDate ? new Date(rest.checkOutDate).toISOString() : null,
                firstName: primaryGuest.firstName,
                lastName: primaryGuest.lastName,
                guestIdCardNumber: primaryGuest.guestIdCardNumber,
                guestPhone: primaryGuest.guestPhone,
                guests: JSON.stringify(guests),
            });
             if(room) await roomApi.update(room.id, { status: 'reserved' });

            logActivity(user!.username, `Reserved room ${roomMap.get(parseInt(roomId, 10))} for ${primaryGuest.firstName} ${primaryGuest.lastName}`);
            showToast(t('reservations.resAdded'), 'success');
            setIsReservationModalOpen(false);
            await fetchData();
        } catch (error) { showToast(t('errors.generic'), 'error');
        } finally { setIsSubmitting(false); }
    };

    const handleCancelReservation = async (reservation: Reservation) => {
        if (!window.confirm(t('reservations.resCancelConfirm'))) return;
        setIsSubmitting(true);
        try {
            await reservationApi.delete(reservation.id);
            logActivity(user!.username, `Canceled reservation for ${reservation.firstName} ${reservation.lastName}`);
            showToast(t('reservations.resCanceled'), 'success');
            await fetchData();
        } catch (error) { showToast(t('errors.generic'), 'error');
        } finally { setIsSubmitting(false); }
    };

    const openAssignModal = (reservation: Reservation) => {
        setReservationToAssign(reservation);
        setSelectedEmployeeForReservation('');
        setIsAssignModalOpen(true);
    };

    const handleAssignAndCheckIn = async () => {
        if (!reservationToAssign || !selectedEmployeeForReservation) return;
        setIsSubmitting(true);
        try {
            const assignmentData = {
                employeeId: parseInt(selectedEmployeeForReservation, 10),
                roomId: reservationToAssign.roomId,
                checkInDate: new Date(reservationToAssign.checkInDate).toISOString(),
                expectedCheckOutDate: reservationToAssign.checkOutDate,
                checkOutDate: null,
            };
            await assignmentApi.create(assignmentData);
            const room = rooms.find(r => r.id === assignmentData.roomId);
            if(room) await roomApi.update(room.id, { currentOccupancy: room.currentOccupancy + 1, status: 'occupied' });
            await reservationApi.delete(reservationToAssign.id);

            const employee = employeeMap.get(assignmentData.employeeId);
            logActivity(user!.username, `Converted reservation to assignment for ${employee?.firstName} ${employee?.lastName}`);
            showToast(t('reservations.resConverted'), 'success');
            setIsAssignModalOpen(false);
            await fetchData();
        } catch (error) { showToast(t('errors.generic'), 'error');
        } finally { setIsSubmitting(false); }
    };
    
     // --- Hosting Actions ---
    const openNewHostingModal = () => {
        setHostingFormData({
            employeeId: '',
            guests: [{ firstName: '', lastName: '', guestIdCardNumber: '', guestPhone: '' }],
            startDate: toDatetimeLocal(new Date().toISOString()),
            endDate: '',
            notes: '',
        });
        setIsHostingModalOpen(true);
    };
    
    const handleHostingGuestChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newGuests = [...hostingFormData.guests];
        newGuests[index] = { ...newGuests[index], [name]: value };
        setHostingFormData(prev => ({ ...prev, guests: newGuests }));
    };

    const handleAddHostingGuest = () => {
        setHostingFormData(prev => ({
            ...prev,
            guests: [...prev.guests, { firstName: '', lastName: '', guestIdCardNumber: '', guestPhone: '' }]
        }));
    };

    const handleRemoveHostingGuest = (index: number) => {
        const newGuests = hostingFormData.guests.filter((_, i) => i !== index);
        setHostingFormData(prev => ({ ...prev, guests: newGuests }));
    };

    const handleHostingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const { employeeId, guests, startDate, endDate, notes } = hostingFormData;
        const primaryGuest = guests[0];

        if (!employeeId || !primaryGuest || !primaryGuest.firstName || !startDate || !endDate) {
             showToast(t('reservations.formError'), 'error');
             setIsSubmitting(false);
             return;
        }

        const hostEmployeeId = parseInt(employeeId, 10);
        const hostAssignment = assignments.find(a => a.employeeId === hostEmployeeId && !a.checkOutDate);
        if (hostAssignment) {
            const room = rooms.find(r => r.id === hostAssignment.roomId);
            if (room && (room.currentOccupancy + guests.length > room.capacity)) {
                showToast(t('errors.roomCapacityExceeded'), 'error');
                setIsSubmitting(false);
                return;
            }
        } else {
            showToast('Host employee is not currently assigned to a room.', 'error');
            setIsSubmitting(false);
            return;
        }

        try {
            await hostingApi.create({
                employeeId: hostEmployeeId,
                guestFirstName: primaryGuest.firstName,
                guestLastName: primaryGuest.lastName,
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                notes: notes || null,
                guests: JSON.stringify(guests),
                status: 'active',
            });
            const employee = employeeMap.get(hostEmployeeId);
            logActivity(user!.username, `Created hosting for ${primaryGuest.firstName} by ${employee?.firstName}`);
            showToast(t('reservations.hostingAdded'), 'success');
            setIsHostingModalOpen(false);
            await fetchData();
        } catch (error) {
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEndHosting = async (hosting: Hosting) => {
        if (!window.confirm(t('reservations.hostingConfirmEnd'))) return;
        setIsSubmitting(true);
        try {
            await hostingApi.update(hosting.id, { status: 'completed' });
            logActivity(user!.username, `Ended hosting for ${hosting.guestFirstName}`);
            showToast(t('reservations.hostingEnded'), 'success');
            await fetchData();
        } catch (error) {
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getExportData = () => {
        let headers: string[], data: (string | null)[][], reportTitle: string;
        
        switch (activeTab) {
            case 'assignments':
                reportTitle = t('reservations.reportTitle');
                headers = [t('employees.firstName'), t('employees.lastName'), t('employees.jobTitle'), t('housing.building'), t('housing.roomNumber'), t('reservations.checkIn'), t('reservations.expectedCheckOut')];
                data = assignments.filter(a => !a.checkOutDate).map(item => {
                    const employee = employeeMap.get(item.employeeId);
                    return [
                        employee ? employee.firstName : t('unknown'),
                        employee ? employee.lastName : '',
                        employee?.jobTitle || '',
                        getRoomBuildingName(item.roomId) || t('unknown'),
                        roomMap.get(item.roomId) || t('unknown'), 
                        new Date(item.checkInDate).toLocaleString(),
                        item.expectedCheckOutDate ? new Date(item.expectedCheckOutDate).toLocaleString() : '—',
                    ];
                });
                break;
            case 'reservations':
                reportTitle = t('reservations.resReportTitle');
                headers = [t('employees.firstName'), t('employees.lastName'), t('reservations.guestPhone'), t('employees.department'), t('reservations.jobTitle'), t('housing.roomNumber'), t('reservations.checkInDate'), t('reservations.checkOutDate')];
                data = reservations.map(item => [
                    item.firstName,
                    item.lastName,
                    item.guestPhone,
                    t(`departments.${item.department}`),
                    item.jobTitle,
                    `${getRoomBuildingName(item.roomId) || t('unknown')} - ${roomMap.get(item.roomId) || t('unknown')}`,
                    new Date(item.checkInDate).toLocaleString(),
                    item.checkOutDate ? new Date(item.checkOutDate).toLocaleString() : '—'
                ]);
                break;
            case 'hosting':
            default:
                 reportTitle = t('reservations.hostingReportTitle');
                 headers = [t('reservations.hostEmployee'), t('employees.firstName'), t('employees.lastName'), t('housing.roomNumber'), t('reservations.startDate'), t('reservations.endDate'), t('reservations.status')];
                 data = hostings.map(item => {
                     const host = employeeMap.get(item.employeeId);
                     const room_id = employeeRoomMap.get(item.employeeId);
                     return [
                         host ? `${host.firstName} ${host.lastName}` : t('unknown'),
                         item.guestFirstName,
                         item.guestLastName,
                         room_id ? roomMap.get(room_id) || t('unknown') : t('unknown'),
                         new Date(item.startDate).toLocaleString(),
                         new Date(item.endDate).toLocaleString(),
                         t(`statuses.${item.status}`),
                     ];
                 });
                break;
        }
        return { headers, data, reportTitle };
    }

    const handlePdfExport = async () => {
        setIsPdfExporting(true);
        showToast(t('exporting'), 'info');
        try {
            const { headers, data, reportTitle } = getExportData();
            const filename = `report_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`;
            exportToPdf({ headers, data, title: reportTitle, filename, settings: exportSettings, language });
            logActivity(user!.username, `Exported ${activeTab} to PDF`);
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
            const { headers, data, reportTitle } = getExportData();
            const filename = `report_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`;
            exportToExcel({ headers, data, filename, settings: exportSettings });
            logActivity(user!.username, `Exported ${activeTab} to Excel`);
        } catch (error) {
            console.error("Excel Export failed:", error);
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsExcelExporting(false);
            setIsExportModalOpen(false);
        }
    };

    const formInputClass = "w-full p-2 border border-slate-300 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-200";
    const isExporting = isPdfExporting || isExcelExporting;

    const renderContent = () => {
        if (loading) {
            return <div className="p-6 text-center">{t('loading')}...</div>;
        }
        switch (activeTab) {
            case 'assignments':
                return (
                    <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-100 dark:bg-slate-700 dark:text-slate-400">
                            <tr>
                                <th scope="col" className="px-6 py-3">{t('employees.firstName')}</th>
                                <th scope="col" className="px-6 py-3">{t('employees.lastName')}</th>
                                <th scope="col" className="px-6 py-3">{t('employees.jobTitle')}</th>
                                <th scope="col" className="px-6 py-3">{t('housing.building')}</th>
                                <th scope="col" className="px-6 py-3">{t('housing.roomNumber')}</th>
                                <th scope="col" className="px-6 py-3">{t('reservations.checkIn')}</th>
                                <th scope="col" className="px-6 py-3">{t('reservations.expectedCheckOut')}</th>
                                {canManage && <th scope="col" className="px-6 py-3">{t('actions')}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {assignments.filter(a => !a.checkOutDate).map(a => {
                                const employee = employeeMap.get(a.employeeId);
                                return (
                                <tr key={a.id} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">{employee ? employee.firstName : t('unknown')}</td>
                                    <td className="px-6 py-4">{employee ? employee.lastName : ''}</td>
                                    <td className="px-6 py-4">{employee?.jobTitle}</td>
                                    <td className="px-6 py-4">{getRoomBuildingName(a.roomId) || t('unknown')}</td>
                                    <td className="px-6 py-4">{roomMap.get(a.roomId) || t('unknown')}</td>
                                    <td className="px-6 py-4">{new Date(a.checkInDate).toLocaleString()}</td>
                                    <td className="px-6 py-4">{a.expectedCheckOutDate ? new Date(a.expectedCheckOutDate).toLocaleString() : '—'}</td>
                                    {canManage && !a.checkOutDate && <td className="px-6 py-4"><button onClick={() => openCheckOutModal(a)} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">{t('reservations.checkout')}</button></td>}
                                    {canManage && a.checkOutDate && <td className="px-6 py-4">-</td>}
                                </tr>
                            )})}
                        </tbody>
                    </table>
                );
            case 'reservations':
                return (
                    <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-100 dark:bg-slate-700 dark:text-slate-400">
                            <tr>
                                <th scope="col" className="px-6 py-3">{t('reservations.guestName')}</th>
                                <th scope="col" className="px-6 py-3">{t('reservations.jobTitle')}</th>
                                <th scope="col" className="px-6 py-3">{t('housing.roomNumber')}</th>
                                <th scope="col" className="px-6 py-3">{t('employees.department')}</th>
                                <th scope="col" className="px-6 py-3">{t('reservations.checkInDate')}</th>
                                {canManage && <th scope="col" className="px-6 py-3">{t('actions')}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {reservations.map(r => {
                                const guests = JSON.parse(r.guests || '[]');
                                return (
                                <tr key={r.id} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">{r.firstName} {r.lastName} {guests.length > 1 && `(+${guests.length - 1})`}</td>
                                    <td className="px-6 py-4">{r.jobTitle}</td>
                                    <td className="px-6 py-4">{getRoomBuildingName(r.roomId)} - {roomMap.get(r.roomId) || t('unknown')}</td>
                                    <td className="px-6 py-4">{t(`departments.${r.department}`)}</td>
                                    <td className="px-6 py-4">{new Date(r.checkInDate).toLocaleString()}</td>
                                    {canManage && <td className="px-6 py-4 space-x-4 rtl:space-x-reverse">
                                        <button onClick={() => openAssignModal(r)} className="font-medium text-green-600 dark:text-green-500 hover:underline">{t('reservations.assignAndCheckIn')}</button>
                                        <button onClick={() => handleCancelReservation(r)} className="font-medium text-red-600 dark:text-red-500 hover:underline">{t('cancel')}</button>
                                    </td>}
                                </tr>
                            )})}
                        </tbody>
                    </table>
                );
             case 'hosting':
                return (
                     <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-100 dark:bg-slate-700 dark:text-slate-400">
                            <tr>
                                <th scope="col" className="px-6 py-3">{t('reservations.hostEmployee')}</th>
                                <th scope="col" className="px-6 py-3">{t('reservations.guestName')}</th>
                                <th scope="col" className="px-6 py-3">{t('housing.roomNumber')}</th>
                                <th scope="col" className="px-6 py-3">{t('reservations.startDate')}</th>
                                <th scope="col" className="px-6 py-3">{t('reservations.endDate')}</th>
                                <th scope="col" className="px-6 py-3">{t('reservations.status')}</th>
                                {canManage && <th scope="col" className="px-6 py-3">{t('actions')}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {hostings.map(h => {
                                const host = employeeMap.get(h.employeeId);
                                const roomId = employeeRoomMap.get(h.employeeId);
                                const guests = h.guests ? JSON.parse(h.guests) : [];
                                return (
                                <tr key={h.id} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">{host ? `${host.firstName} ${host.lastName}` : t('unknown')}</td>
                                    <td className="px-6 py-4">{h.guestFirstName} {h.guestLastName} {guests.length > 1 && `(+${guests.length - 1})`}</td>
                                    <td className="px-6 py-4">{roomId ? roomMap.get(roomId) : t('unknown')}</td>
                                    <td className="px-6 py-4">{new Date(h.startDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">{new Date(h.endDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">{t(`statuses.${h.status}`)}</td>
                                    {canManage && h.status === 'active' && <td className="px-6 py-4"><button onClick={() => handleEndHosting(h)} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">{t('reservations.endHosting')}</button></td>}
                                </tr>
                            )})}
                        </tbody>
                    </table>
                );
        }
    };


    return (
        <>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">{t('layout.reservations')}</h1>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md">
                    <div className="p-4 flex flex-wrap justify-between items-center border-b dark:border-slate-700 gap-4">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                            <button onClick={() => setActiveTab('assignments')} className={`px-3 py-2 text-sm rounded-md ${activeTab === 'assignments' ? 'bg-primary-600 text-white font-semibold' : 'bg-slate-200 dark:bg-slate-700'}`}>{t('reservations.active')}</button>
                            <button onClick={() => setActiveTab('reservations')} className={`px-3 py-2 text-sm rounded-md ${activeTab === 'reservations' ? 'bg-primary-600 text-white font-semibold' : 'bg-slate-200 dark:bg-slate-700'}`}>{t('reservations.future')}</button>
                            <button onClick={() => setActiveTab('hosting')} className={`px-3 py-2 text-sm rounded-md ${activeTab === 'hosting' ? 'bg-primary-600 text-white font-semibold' : 'bg-slate-200 dark:bg-slate-700'}`}>{t('reservations.hosting')}</button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => setIsExportModalOpen(true)} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm disabled:opacity-50" disabled={isExporting}>
                                {isExporting ? <><i className="fas fa-spinner fa-spin me-2"></i>{t('exporting')}</> : <><i className="fas fa-download me-2"></i>{t('export')}</>}
                            </button>
                            {canManage && activeTab === 'assignments' && <button onClick={openNewAssignmentModal} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"><i className="fas fa-plus me-2"></i>{t('reservations.new')}</button>}
                            {canManage && activeTab === 'reservations' && <button onClick={openNewReservationModal} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"><i className="fas fa-plus me-2"></i>{t('reservations.newRes')}</button>}
                             {canManage && activeTab === 'hosting' && <button onClick={openNewHostingModal} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"><i className="fas fa-plus me-2"></i>{t('reservations.newHosting')}</button>}
                        </div>
                    </div>
                     <div className="relative overflow-x-auto">{renderContent()}</div>
                </div>
            </div>

            {isAssignmentModalOpen && canManage && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h2 className="text-xl font-bold mb-4">{t('reservations.new')}</h2>
                        <form onSubmit={handleAssignmentSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('layout.employees')}</label><select name="employeeId" value={assignmentFormData.employeeId} onChange={e => setAssignmentFormData(p => ({...p, employeeId: e.target.value}))} required className={formInputClass}><option value="" disabled>-- {t('select')} --</option>{availableEmployees.map(e => <option key={e.id} value={e.id}>{`${e.firstName} ${e.lastName}`}</option>)}</select></div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.room')}</label><select name="roomId" value={assignmentFormData.roomId} onChange={e => setAssignmentFormData(p => ({...p, roomId: e.target.value}))} required className={formInputClass}><option value="" disabled>-- {t('select')} --</option>{availableRooms.map(r => <option key={r.id} value={r.id}>{`${getRoomBuildingName(r.id)} - ${r.roomNumber} (${t('housing.occupancy')}: ${r.currentOccupancy}/${r.capacity})`}</option>)}</select></div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.checkIn')}</label><input type="datetime-local" name="checkInDate" value={assignmentFormData.checkInDate} onChange={e => setAssignmentFormData(p => ({...p, checkInDate: e.target.value}))} required className={formInputClass}/></div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.expectedCheckOut')}</label><input type="datetime-local" name="expectedCheckOutDate" value={assignmentFormData.expectedCheckOutDate} onChange={e => setAssignmentFormData(p => ({...p, expectedCheckOutDate: e.target.value}))} min={assignmentFormData.checkInDate} className={formInputClass}/></div>
                            </div>
                            <div className="flex justify-end gap-4 mt-6"><button type="button" onClick={() => setIsAssignmentModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">{isSubmitting ? `${t('saving')}...` : t('save')}</button></div>
                        </form>
                    </div>
                </div>
            )}
            
            {isReservationModalOpen && canManage && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">{t('reservations.newRes')}</h2>
                        <form onSubmit={handleReservationSubmit}>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                <div className="md:col-span-2"><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.room')}</label><select name="roomId" value={reservationFormData.roomId} onChange={handleReservationFormChange} required className={formInputClass}><option value="" disabled>-- {t('select')} --</option>{availableRooms.map(r => <option key={r.id} value={r.id}>{`${getRoomBuildingName(r.id)} - ${r.roomNumber} (${t('housing.occupancy')}: ${r.currentOccupancy}/${r.capacity})`}</option>)}</select></div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.department')}</label>
                                    <select name="department" value={reservationFormData.department} onChange={handleReservationFormChange} required className={formInputClass}>{DEPARTMENTS.map(dept => (<option key={dept} value={dept}>{t(`departments.${dept}`)}</option>))}</select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.jobTitle')}</label>
                                    <select name="jobTitle" value={reservationFormData.jobTitle} onChange={handleReservationFormChange} required className={formInputClass}>{departmentJobTitles[reservationFormData.department]?.map(title => (<option key={title} value={title}>{title}</option>))}</select>
                                </div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.checkInDate')}</label><input type="datetime-local" name="checkInDate" value={reservationFormData.checkInDate} onChange={handleReservationFormChange} required className={formInputClass}/></div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.checkOutDate')}</label><input type="datetime-local" name="checkOutDate" value={reservationFormData.checkOutDate} onChange={handleReservationFormChange} min={reservationFormData.checkInDate} className={formInputClass}/></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.notes')}</label><textarea name="notes" value={reservationFormData.notes} onChange={handleReservationFormChange} rows={2} className={formInputClass}></textarea></div>
                            </div>
                            <hr className="my-4 dark:border-slate-600"/>
                            {reservationFormData.guests.map((guest, index) => (
                                <div key={index} className="border-b dark:border-slate-700 pb-3 mb-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-semibold text-slate-700 dark:text-slate-300">{t('reservations.guestDetails')} #{index + 1}</h3>
                                        {reservationFormData.guests.length > 1 && <button type="button" onClick={() => handleRemoveGuest(index)} className="text-red-500 hover:text-red-700 text-sm">{t('reservations.removeGuest')}</button>}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                        <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.firstName')}</label><input type="text" name="firstName" value={guest.firstName} onChange={e => handleGuestChange(index, e)} required className={formInputClass}/></div>
                                        <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.lastName')}</label><input type="text" name="lastName" value={guest.lastName} onChange={e => handleGuestChange(index, e)} className={formInputClass}/></div>
                                        <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.guestPhone')}</label><input type="text" name="guestPhone" value={guest.guestPhone} onChange={e => handleGuestChange(index, e)} required className={formInputClass}/></div>
                                        <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.guestIdCardNumber')}</label><input type="text" name="guestIdCardNumber" value={guest.guestIdCardNumber} onChange={e => handleGuestChange(index, e)} required className={formInputClass}/></div>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={handleAddGuest} className="w-full mt-2 px-4 py-2 text-sm border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">{t('reservations.addGuest')}</button>
                            <div className="flex justify-end gap-4 mt-6"><button type="button" onClick={() => setIsReservationModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">{isSubmitting ? `${t('saving')}...` : t('save')}</button></div>
                        </form>
                    </div>
                </div>
            )}
            
             {isHostingModalOpen && canManage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">{t('reservations.newHosting')}</h2>
                        <form onSubmit={handleHostingSubmit}>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.hostEmployee')}</label>
                                    <select name="employeeId" value={hostingFormData.employeeId} onChange={e => setHostingFormData(p => ({...p, employeeId: e.target.value}))} required className={formInputClass}>
                                        <option value="" disabled>-- {t('select')} --</option>
                                        {housedEmployees.map(e => <option key={e.id} value={e.id}>{`${e.firstName} ${e.lastName} (${t('housing.room')}: ${roomMap.get(employeeRoomMap.get(e.id)!)})`}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.startDate')}</label>
                                    <input type="datetime-local" name="startDate" value={hostingFormData.startDate} onChange={e => setHostingFormData(p => ({...p, startDate: e.target.value}))} required className={formInputClass}/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.endDate')}</label>
                                    <input type="datetime-local" name="endDate" value={hostingFormData.endDate} onChange={e => setHostingFormData(p => ({...p, endDate: e.target.value}))} required min={hostingFormData.startDate} className={formInputClass}/>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.notes')}</label>
                                    <textarea name="notes" value={hostingFormData.notes} onChange={e => setHostingFormData(p => ({...p, notes: e.target.value}))} rows={2} className={formInputClass}></textarea>
                                </div>
                            </div>
                            <hr className="my-4 dark:border-slate-600"/>
                            {hostingFormData.guests.map((guest, index) => (
                                <div key={index} className="border-b dark:border-slate-700 pb-3 mb-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-semibold text-slate-700 dark:text-slate-300">{t('reservations.guestDetails')} #{index + 1}</h3>
                                        {hostingFormData.guests.length > 1 && <button type="button" onClick={() => handleRemoveHostingGuest(index)} className="text-red-500 hover:text-red-700 text-sm">{t('reservations.removeGuest')}</button>}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                        <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.firstName')}</label><input type="text" name="firstName" value={guest.firstName} onChange={e => handleHostingGuestChange(index, e)} required className={formInputClass}/></div>
                                        <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('employees.lastName')}</label><input type="text" name="lastName" value={guest.lastName} onChange={e => handleHostingGuestChange(index, e)} className={formInputClass}/></div>
                                        <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.guestPhone')}</label><input type="text" name="guestPhone" value={guest.guestPhone} onChange={e => handleHostingGuestChange(index, e)} required className={formInputClass}/></div>
                                        <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.guestIdCardNumber')}</label><input type="text" name="guestIdCardNumber" value={guest.guestIdCardNumber} onChange={e => handleHostingGuestChange(index, e)} required className={formInputClass}/></div>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={handleAddHostingGuest} className="w-full mt-2 px-4 py-2 text-sm border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">{t('reservations.addGuest')}</button>
                            <div className="flex justify-end gap-4 mt-6"><button type="button" onClick={() => setIsHostingModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">{isSubmitting ? `${t('saving')}...` : t('save')}</button></div>
                        </form>
                    </div>
                </div>
            )}

            {isCheckOutModalOpen && assignmentToCheckOut && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{t('reservations.checkoutTitle')}</h2>
                        <p className="mb-4 text-slate-600 dark:text-slate-400">{t('reservations.checkoutMessage', { name: `${employeeMap.get(assignmentToCheckOut.employeeId)?.firstName} ${employeeMap.get(assignmentToCheckOut.employeeId)?.lastName}` || 'Employee' })}</p>
                        <div className="mb-6"><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('reservations.checkOut')}</label><input type="datetime-local" value={checkOutDate} onChange={e => setCheckOutDate(e.target.value)} required className={formInputClass}/></div>
                        <div className="flex justify-end gap-4"><button type="button" onClick={() => setIsCheckOutModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button><button onClick={handleConfirmCheckOut} disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">{isSubmitting ? `${t('saving')}...` : t('reservations.confirmCheckout')}</button></div>
                    </div>
                </div>
            )}

            {isAssignModalOpen && reservationToAssign && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                   <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                       <h2 className="text-xl font-bold mb-4">{t('reservations.assignAndCheckInTitle')}</h2>
                       <p className="mb-4 text-slate-600 dark:text-slate-400">{t('reservations.assignMessage', { name: `${reservationToAssign.firstName} ${reservationToAssign.lastName}`, room: roomMap.get(reservationToAssign.roomId) })}</p>
                       <div className="mb-6">
                           <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('layout.employees')}</label>
                           <select value={selectedEmployeeForReservation} onChange={e => setSelectedEmployeeForReservation(e.target.value)} required className={formInputClass}>
                               <option value="" disabled>-- {t('select')} --</option>
                               {availableEmployees.map(e => <option key={e.id} value={e.id}>{`${e.firstName} ${e.lastName} (${e.jobTitle})`}</option>)}
                            </select>
                        </div>
                       <div className="flex justify-end gap-4"><button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button><button onClick={handleAssignAndCheckIn} disabled={isSubmitting} className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-green-400">{isSubmitting ? `${t('saving')}...` : t('reservations.confirmCheckIn')}</button></div>
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

export default ReservationsPage;