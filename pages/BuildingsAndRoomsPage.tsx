import React, { useState, useEffect, useMemo } from 'react';
import { Building, Room, Floor } from '../types';
import { buildingApi, roomApi, floorApi, logActivity } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useExportSettings } from '../context/ExportSettingsContext';
import { exportToPdf, exportToExcel } from '../services/exportService';
import ExportOptionsModal from '../components/ExportOptionsModal';

const BuildingsAndRoomsPage: React.FC = () => {
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [floors, setFloors] = useState<Floor[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuth();
    const { language, t } = useLanguage();
    const { showToast } = useToast();
    const canManage = user?.roles?.some(r => ['super_admin', 'admin', 'manager'].includes(r));
    const [activeTab, setActiveTab] = useState<'buildings' | 'floors' | 'rooms'>('buildings');
    const { settings: exportSettings } = useExportSettings();

    const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
    const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
    const [buildingFormData, setBuildingFormData] = useState({ name: '', location: '', capacity: '100', status: 'active' as Building['status'] });

    const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
    const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
    const [floorFormData, setFloorFormData] = useState({ floorNumber: '', description: '', buildingId: '' });

    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [roomFormData, setRoomFormData] = useState({ floorId: '', roomNumber: '', capacity: '2' });
    const [modalSelectedBuildingId, setModalSelectedBuildingId] = useState<string>('');
    
    // State for bulk actions
    const [selectedRooms, setSelectedRooms] = useState<Set<number>>(new Set());
    const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
    const [bulkStatus, setBulkStatus] = useState<'available' | 'maintenance'>('available');
    
    const [selectedBuildings, setSelectedBuildings] = useState<Set<number>>(new Set());
    const [isBulkBuildingStatusModalOpen, setIsBulkBuildingStatusModalOpen] = useState(false);
    const [bulkBuildingStatus, setBulkBuildingStatus] = useState<Building['status']>('active');

    const [selectedFloors, setSelectedFloors] = useState<Set<number>>(new Set());
    const [isBulkDeleteFloorModalOpen, setIsBulkDeleteFloorModalOpen] = useState(false);


    const fetchData = async () => {
        setLoading(true);
        try {
            const [buildingsData, floorsData, roomsData] = await Promise.all([buildingApi.getAll(), floorApi.getAll(), roomApi.getAll()]);
            setBuildings(buildingsData);
            setFloors(floorsData);
            setRooms(roomsData);
        } catch (error) {
            console.error("Failed to fetch data", error);
            showToast(t('errors.fetchFailed'), 'error');
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);
    
    useEffect(() => {
        setSelectedBuildings(new Set());
        setSelectedFloors(new Set());
        setSelectedRooms(new Set());
    }, [activeTab]);


    const openAddBuildingModal = () => {
        setEditingBuilding(null);
        setBuildingFormData({ name: '', location: '', capacity: '100', status: 'active' });
        setIsBuildingModalOpen(true);
    };

    const openEditBuildingModal = (building: Building) => {
        setEditingBuilding(building);
        setBuildingFormData({ ...building, capacity: String(building.capacity) });
        setIsBuildingModalOpen(true);
    };
    
    const handleBuildingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const isDuplicate = buildings.some(b => b.name.trim().toLowerCase() === buildingFormData.name.trim().toLowerCase() && b.id !== editingBuilding?.id);
        if (isDuplicate) {
            showToast(t('errors.duplicateBuildingName', { name: buildingFormData.name }), 'error');
            return;
        }
        setIsSubmitting(true);
        const data = { ...buildingFormData, capacity: parseInt(buildingFormData.capacity, 10) };
        try {
            if (editingBuilding) {
                await buildingApi.update(editingBuilding.id, data);
                logActivity(user!.username, `Updated building: ${data.name}`);
                showToast(t('housing.buildingUpdated'), 'success');
            } else {
                await buildingApi.create(data);
                logActivity(user!.username, `Created building: ${data.name}`);
                showToast(t('housing.buildingAdded'), 'success');
            }
            setIsBuildingModalOpen(false);
            await fetchData();
        } catch (error) {
            showToast(t('errors.generic'), 'error');
        } finally { setIsSubmitting(false); }
    };

    const openAddFloorModal = (buildingId?: number) => {
        setEditingFloor(null);
        setFloorFormData({ floorNumber: '', description: '', buildingId: buildingId ? String(buildingId) : '' });
        setIsFloorModalOpen(true);
    };

    const openEditFloorModal = (floor: Floor) => {
        setEditingFloor(floor);
        setFloorFormData({ floorNumber: floor.floorNumber, description: floor.description, buildingId: String(floor.buildingId) });
        setIsFloorModalOpen(true);
    };
    
    const handleFloorSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!floorFormData.buildingId) return;
        const buildingId = parseInt(floorFormData.buildingId, 10);
        const building = buildings.find(b => b.id === buildingId);

        const buildingFloors = floors.filter(f => f.buildingId === buildingId);
        const isDuplicate = buildingFloors.some(f => f.floorNumber.trim().toLowerCase() === floorFormData.floorNumber.trim().toLowerCase() && f.id !== editingFloor?.id);
        if (isDuplicate) {
            showToast(t('errors.duplicateFloorNumber', { number: floorFormData.floorNumber, building: building?.name }), 'error');
            return;
        }

        setIsSubmitting(true);
        const data = { ...floorFormData, buildingId };
        try {
            if (editingFloor) {
                await floorApi.update(editingFloor.id, data);
                logActivity(user!.username, `Updated floor ${data.floorNumber} in building ${building?.name}`);
                showToast(t('housing.floorUpdated'), 'success');
            } else {
                await floorApi.create(data);
                logActivity(user!.username, `Created floor ${data.floorNumber} in building ${building?.name}`);
                showToast(t('housing.floorAdded'), 'success');
            }
            setIsFloorModalOpen(false);
            await fetchData();
        } catch (error) {
            showToast(t('errors.generic'), 'error');
        } finally { setIsSubmitting(false); }
    };
    
    const openAddRoomModal = (floorId: number) => {
        setEditingRoom(null);
        const floor = floors.find(f => f.id === floorId);
        setModalSelectedBuildingId(floor ? String(floor.buildingId) : '');
        setRoomFormData({ floorId: String(floorId), roomNumber: '', capacity: '2' });
        setIsRoomModalOpen(true);
    };
    
    const openEditRoomModal = (room: Room) => {
        const floor = floors.find(f => f.id === room.floorId);
        setEditingRoom(room);
        setModalSelectedBuildingId(floor ? String(floor.buildingId) : '');
        setRoomFormData({ ...room, floorId: String(room.floorId), capacity: String(room.capacity) });
        setIsRoomModalOpen(true);
    };
    
    const handleRoomSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!roomFormData.floorId) {
            showToast(t('errors.generic'), 'error'); // A more specific error would be better
            return;
        }
        const isDuplicate = rooms.some(r => r.roomNumber.trim().toLowerCase() === roomFormData.roomNumber.trim().toLowerCase() && r.id !== editingRoom?.id);
        if (isDuplicate) {
            showToast(t('errors.duplicateRoomNumber', { number: roomFormData.roomNumber }), 'error');
            return;
        }
        setIsSubmitting(true);
        const data = { ...roomFormData, floorId: parseInt(roomFormData.floorId, 10), capacity: parseInt(roomFormData.capacity, 10) };
        try {
            if (editingRoom) {
                await roomApi.update(editingRoom.id, data);
                logActivity(user!.username, `Updated room ${data.roomNumber}`);
                showToast(t('housing.roomUpdated'), 'success');
            } else {
                await roomApi.create({ ...data, currentOccupancy: 0, status: 'available' });
                logActivity(user!.username, `Created room ${data.roomNumber}`);
                showToast(t('housing.roomAdded'), 'success');
            }
            setIsRoomModalOpen(false);
            await fetchData();
        } catch (error) {
            showToast(t('errors.generic'), 'error');
        } finally { setIsSubmitting(false); }
    };

    const handleConfirmBulkStatusChange = async () => {
        setIsSubmitting(true);
        const roomsToUpdate = Array.from(selectedRooms).map(id => rooms.find(r => r.id === id)).filter(Boolean) as Room[];
        
        const validRoomsToUpdate: Room[] = [];
        const skippedRooms: Room[] = [];

        if (bulkStatus === 'maintenance') {
            roomsToUpdate.forEach(room => {
                if (room.currentOccupancy > 0 || room.status === 'occupied' || room.status === 'reserved') {
                    skippedRooms.push(room);
                } else {
                    validRoomsToUpdate.push(room);
                }
            });
        } else {
            validRoomsToUpdate.push(...roomsToUpdate);
        }
        
        if (skippedRooms.length > 0) {
            showToast(t('errors.bulkUpdateSkipped', { count: skippedRooms.length }), 'info');
        }

        if (validRoomsToUpdate.length === 0) {
            setIsSubmitting(false);
            setIsBulkStatusModalOpen(false);
            if(skippedRooms.length === 0) showToast(t('housing.noRoomsToAction'), 'info');
            return;
        }

        try {
            const updatePromises = validRoomsToUpdate.map(room => roomApi.update(room.id, { status: bulkStatus }));
            await Promise.all(updatePromises);
            
            logActivity(user!.username, `Bulk updated status to ${bulkStatus} for ${validRoomsToUpdate.length} rooms.`);
            showToast(t('housing.bulkStatusUpdated', { count: validRoomsToUpdate.length }), 'success');
            
            await fetchData();
            setSelectedRooms(new Set());
        } catch (error) {
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsSubmitting(false);
            setIsBulkStatusModalOpen(false);
        }
    };

    const handleConfirmBulkBuildingStatusChange = async () => {
        setIsSubmitting(true);
        const buildingsToUpdate = Array.from(selectedBuildings).map(id => buildings.find(b => b.id === id)).filter(Boolean) as Building[];
        
        const validBuildings: Building[] = [];
        const skippedBuildings: Building[] = [];
        
        if (bulkBuildingStatus === 'inactive') {
            const floorToBuildingMap = new Map(floors.map(f => [f.id, f.buildingId]));
            const occupiedBuildingIds = new Set<number>();
            rooms.forEach(room => {
                if (room.currentOccupancy > 0 || room.status === 'occupied' || room.status === 'reserved') {
                    const buildingId = floorToBuildingMap.get(room.floorId);
                    // FIX: Argument of type 'unknown' is not assignable to parameter of type 'number'.
                    if (typeof buildingId === 'number') {
                        occupiedBuildingIds.add(buildingId);
                    }
                }
            });
            buildingsToUpdate.forEach(b => {
                if (occupiedBuildingIds.has(b.id)) {
                    skippedBuildings.push(b);
                } else {
                    validBuildings.push(b);
                }
            });
        } else {
            validBuildings.push(...buildingsToUpdate);
        }
        
        if (skippedBuildings.length > 0) {
            showToast(t('errors.bulkUpdateBuildingsSkipped', { count: skippedBuildings.length }), 'info');
        }
        if (validBuildings.length === 0) {
            setIsSubmitting(false);
            setIsBulkBuildingStatusModalOpen(false);
            return;
        }

        try {
            const updatePromises = validBuildings.map(b => buildingApi.update(b.id, { status: bulkBuildingStatus }));
            await Promise.all(updatePromises);
            logActivity(user!.username, `Bulk updated status to ${bulkBuildingStatus} for ${validBuildings.length} buildings.`);
            showToast(t('housing.bulkBuildingStatusUpdated', { count: validBuildings.length }), 'success');
            await fetchData();
            setSelectedBuildings(new Set());
        } catch (error) {
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsSubmitting(false);
            setIsBulkBuildingStatusModalOpen(false);
        }
    };

    const handleConfirmBulkFloorDelete = async () => {
        setIsSubmitting(true);
        const floorsToDelete = Array.from(selectedFloors).map(id => floors.find(f => f.id === id)).filter(Boolean) as Floor[];
        
        const validFloors: Floor[] = [];
        const skippedFloors: Floor[] = [];
        const floorIdsWithRooms = new Set(rooms.map(r => r.floorId));
        
        floorsToDelete.forEach(floor => {
            if (floorIdsWithRooms.has(floor.id)) {
                skippedFloors.push(floor);
            } else {
                validFloors.push(floor);
            }
        });

        if (skippedFloors.length > 0) {
            showToast(t('errors.floorHasRooms', { count: skippedFloors.length }), 'error');
        }

        if (validFloors.length === 0) {
            setIsSubmitting(false);
            setIsBulkDeleteFloorModalOpen(false);
            return;
        }
        
        try {
            const deletePromises = validFloors.map(f => floorApi.delete(f.id));
            await Promise.all(deletePromises);
            logActivity(user!.username, `Bulk deleted ${validFloors.length} floors.`);
            showToast(t('housing.bulkFloorsDeleted', { count: validFloors.length }), 'success');
            await fetchData();
            setSelectedFloors(new Set());
        } catch(error) {
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsSubmitting(false);
            setIsBulkDeleteFloorModalOpen(false);
        }
    };

    const formInputClass = "w-full p-2 border border-slate-300 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-200";

    return (
        <div className="space-y-6">
            <h1 className="text-4xl font-bold text-slate-800 dark:text-white mb-6">{t('layout.housing')}</h1>

            <div className="mb-4 border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {(['buildings', 'floors', 'rooms'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`${tab === activeTab
                                    ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-500'
                                } whitespace-nowrap pb-3 pt-4 px-2 border-b-4 font-semibold text-lg transition-colors`}
                        >
                            {t(`housing.tabs.${tab}`)}
                        </button>
                    ))}
                </nav>
            </div>

            {loading ? <div className="p-4 text-center">{t('loading')}...</div> : (
                <>
                    {activeTab === 'buildings' && <BuildingsView buildings={buildings} onAdd={openAddBuildingModal} onEdit={openEditBuildingModal} canManage={canManage} t={t} selectedBuildings={selectedBuildings} setSelectedBuildings={setSelectedBuildings} onBulkStatusClick={() => setIsBulkBuildingStatusModalOpen(true)} />}
                    {activeTab === 'floors' && <FloorsView buildings={buildings} floors={floors} rooms={rooms} onAdd={openAddFloorModal} onEdit={openEditFloorModal} canManage={canManage} t={t} selectedFloors={selectedFloors} setSelectedFloors={setSelectedFloors} onBulkDeleteClick={() => setIsBulkDeleteFloorModalOpen(true)} />}
                    {activeTab === 'rooms' && <RoomsView buildings={buildings} floors={floors} rooms={rooms} onAdd={openAddRoomModal} onEdit={openEditRoomModal} canManage={canManage} t={t} fetchData={fetchData} selectedRooms={selectedRooms} setSelectedRooms={setSelectedRooms} onBulkStatusClick={() => setIsBulkStatusModalOpen(true)} />}
                </>
            )}

            {isBuildingModalOpen && canManage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">{editingBuilding ? t('housing.editBuilding') : t('housing.addBuilding')}</h2>
                        <form onSubmit={handleBuildingSubmit}>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.buildingName')}</label><input type="text" value={buildingFormData.name} onChange={e => setBuildingFormData(p => ({...p, name: e.target.value}))} required className={formInputClass}/></div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.location')}</label><input type="text" value={buildingFormData.location} onChange={e => setBuildingFormData(p => ({...p, location: e.target.value}))} required className={formInputClass}/></div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.buildingCapacity')}</label><input type="number" min="1" value={buildingFormData.capacity} onChange={e => setBuildingFormData(p => ({...p, capacity: e.target.value}))} required className={formInputClass}/></div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.buildingStatus')}</label><select value={buildingFormData.status} onChange={e => setBuildingFormData(p => ({...p, status: e.target.value as Building['status']}))} className={formInputClass}><option value="active">{t('statuses.active')}</option><option value="inactive">{t('statuses.inactive')}</option></select></div>
                            </div>
                            <div className="flex justify-end gap-4 mt-6">
                                <button type="button" onClick={() => setIsBuildingModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">{isSubmitting ? `${t('saving')}...` : t('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {isFloorModalOpen && canManage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">{editingFloor ? t('housing.editFloor') : t('housing.addFloor')}</h2>
                        <form onSubmit={handleFloorSubmit}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.buildings')}</label>
                                    <select value={floorFormData.buildingId} onChange={e => setFloorFormData(p=>({...p, buildingId: e.target.value}))} required className={formInputClass}>
                                        <option value="" disabled>-- {t('select')} --</option>
                                        {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.floorNumber')}</label><input type="text" value={floorFormData.floorNumber} onChange={e => setFloorFormData(p=>({...p, floorNumber: e.target.value}))} required className={formInputClass}/></div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.description')}</label><textarea value={floorFormData.description} onChange={e => setFloorFormData(p=>({...p, description: e.target.value}))} rows={3} className={formInputClass}/></div>
                            </div>
                            <div className="flex justify-end gap-4 mt-6">
                                <button type="button" onClick={() => setIsFloorModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">{isSubmitting ? `${t('saving')}...` : t('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {isRoomModalOpen && canManage && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200">{editingRoom ? t('housing.editRoom') : t('housing.addRoom')}</h2>
                        <form onSubmit={handleRoomSubmit}>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.buildings')}</label>
                                            <select 
                                                value={modalSelectedBuildingId} 
                                                onChange={e => {
                                                    setModalSelectedBuildingId(e.target.value);
                                                    setRoomFormData(p => ({...p, floorId: ''}));
                                                }} 
                                                required 
                                                className={formInputClass}
                                            >
                                                <option value="" disabled>-- {t('select')} --</option>
                                                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.floor')}</label>
                                            <select 
                                                value={roomFormData.floorId} 
                                                onChange={e => setRoomFormData(p => ({...p, floorId: e.target.value}))} 
                                                required 
                                                disabled={!modalSelectedBuildingId}
                                                className={formInputClass}
                                            >
                                                <option value="" disabled>-- {t('select')} --</option>
                                                {floors.filter(f => f.buildingId === parseInt(modalSelectedBuildingId, 10)).map(f => (
                                                    <option key={f.id} value={f.id}>{f.floorNumber}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.roomNumber')}</label><input type="text" value={roomFormData.roomNumber} onChange={e => setRoomFormData(p => ({...p, roomNumber: e.target.value}))} required className={formInputClass}/></div>
                                <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.capacity')}</label><input type="number" min="1" value={roomFormData.capacity} onChange={e => setRoomFormData(p => ({...p, capacity: e.target.value}))} required className={formInputClass}/></div>
                            </div>
                            <div className="flex justify-end gap-4 mt-6">
                                <button type="button" onClick={() => setIsRoomModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">{isSubmitting ? `${t('saving')}...` : t('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
             {isBulkStatusModalOpen && canManage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{t('housing.bulkStatusModalTitle')}</h2>
                        <p className="mb-4 text-slate-600 dark:text-slate-400">{t('housing.confirmBulkStatusChange', { count: selectedRooms.size, status: t(`statuses.${bulkStatus}`) })}</p>
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.newStatus')}</label>
                            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as any)} className={formInputClass}>
                                <option value="available">{t('statuses.available')}</option>
                                <option value="maintenance">{t('statuses.maintenance')}</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-4">
                            <button type="button" onClick={() => setIsBulkStatusModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button>
                            <button onClick={handleConfirmBulkStatusChange} disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">{isSubmitting ? `${t('saving')}...` : t('save')}</button>
                        </div>
                    </div>
                </div>
            )}
             {isBulkBuildingStatusModalOpen && canManage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{t('housing.bulkBuildingStatusModalTitle')}</h2>
                        <p className="mb-4 text-slate-600 dark:text-slate-400">{t('housing.confirmBulkBuildingStatusChange', { count: selectedBuildings.size, status: t(`statuses.${bulkBuildingStatus}`) })}</p>
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('housing.newStatus')}</label>
                            <select value={bulkBuildingStatus} onChange={e => setBulkBuildingStatus(e.target.value as any)} className={formInputClass}>
                                <option value="active">{t('statuses.active')}</option>
                                <option value="inactive">{t('statuses.inactive')}</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-4">
                            <button type="button" onClick={() => setIsBulkBuildingStatusModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button>
                            <button onClick={handleConfirmBulkBuildingStatusChange} disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">{isSubmitting ? `${t('saving')}...` : t('save')}</button>
                        </div>
                    </div>
                </div>
            )}
             {isBulkDeleteFloorModalOpen && canManage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{t('housing.bulkDeleteFloorsModalTitle')}</h2>
                        <p className="mb-4 text-slate-600 dark:text-slate-400">{t('housing.confirmBulkDeleteFloors', { count: selectedFloors.size })}</p>
                        <div className="flex justify-end gap-4">
                            <button type="button" onClick={() => setIsBulkDeleteFloorModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button>
                            <button onClick={handleConfirmBulkFloorDelete} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded disabled:bg-red-400">{isSubmitting ? `${t('deleting')}...` : t('delete')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Sub-components for Tabs ---

const BuildingsView = ({ buildings, onAdd, onEdit, canManage, t, selectedBuildings, setSelectedBuildings, onBulkStatusClick }: any) => {
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedBuildings(new Set(buildings.map((b: Building) => b.id)));
        } else {
            setSelectedBuildings(new Set());
        }
    };

    const handleSelect = (id: number) => {
        const newSelection = new Set(selectedBuildings);
        if (newSelection.has(id)) newSelection.delete(id);
        else newSelection.add(id);
        setSelectedBuildings(newSelection);
    };

    const numSelected = selectedBuildings.size;
    const isAllSelected = buildings.length > 0 && numSelected === buildings.length;
    const isIndeterminate = numSelected > 0 && numSelected < buildings.length;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md">
            <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                <h2 className="font-semibold text-slate-800 dark:text-slate-200">{t('housing.tabs.buildings')}</h2>
                {canManage && <button onClick={onAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"><i className="fas fa-plus me-2"></i>{t('housing.addBuilding')}</button>}
            </div>
             {numSelected > 0 && canManage && (
                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border-b dark:border-slate-700 flex items-center gap-4">
                    <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">{t('housing.buildingsSelected', { count: numSelected })}</span>
                    <button onClick={onBulkStatusClick} className="px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">{t('housing.changeStatus')}</button>
                </div>
            )}
            <div className="relative overflow-x-auto">
                <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                    <thead className="text-sm text-slate-500 font-semibold bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                        <tr>
                            {canManage && <th scope="col" className="p-4"><input type="checkbox" ref={el => { if (el) { el.indeterminate = isIndeterminate; } }} checked={isAllSelected} onChange={handleSelectAll} className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500" aria-label={t('housing.selectAllBuildings')} /></th>}
                            <th scope="col" className="px-6 py-3">{t('housing.buildingName')}</th>
                            <th scope="col" className="px-6 py-3">{t('housing.location')}</th>
                            <th scope="col" className="px-6 py-3">{t('housing.capacity')}</th>
                            <th scope="col" className="px-6 py-3">{t('housing.buildingStatus')}</th>
                            {canManage && <th scope="col" className="px-6 py-3">{t('actions')}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {buildings.map((b: Building) => (
                            <tr key={b.id} className={`border-b dark:border-slate-700 ${selectedBuildings.has(b.id) ? 'bg-primary-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                                {canManage && <td className="p-4"><input type="checkbox" checked={selectedBuildings.has(b.id)} onChange={() => handleSelect(b.id)} className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500" aria-label={t('housing.selectBuilding', {name: b.name})} /></td>}
                                <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">{b.name}</td>
                                <td className="px-6 py-4">{b.location}</td>
                                <td className="px-6 py-4">{b.capacity}</td>
                                <td className="px-6 py-4">{t(`statuses.${b.status}`)}</td>
                                {canManage && <td className="px-6 py-4"><button onClick={() => onEdit(b)} className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800">{t('edit')}</button></td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const FloorsView = ({ buildings, floors, rooms, onAdd, onEdit, canManage, t, selectedFloors, setSelectedFloors, onBulkDeleteClick }: any) => {
    const [selectedBuildingId, setSelectedBuildingId] = useState<string>(buildings[0]?.id.toString() || '');
    
    const filteredFloors = useMemo(() => {
        if (!selectedBuildingId) return [];
        return floors.filter((f: Floor) => f.buildingId === parseInt(selectedBuildingId, 10));
    }, [floors, selectedBuildingId]);
    
    useEffect(() => {
        setSelectedFloors(new Set());
    }, [selectedBuildingId]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedFloors(new Set(filteredFloors.map((f: Floor) => f.id)));
        } else {
            setSelectedFloors(new Set());
        }
    };

    const handleSelect = (id: number) => {
        const newSelection = new Set(selectedFloors);
        if (newSelection.has(id)) newSelection.delete(id);
        else newSelection.add(id);
        setSelectedFloors(newSelection);
    };
    
    const numSelected = selectedFloors.size;
    const isAllSelected = filteredFloors.length > 0 && numSelected === filteredFloors.length;
    const isIndeterminate = numSelected > 0 && numSelected < filteredFloors.length;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md">
            <div className="p-4 border-b dark:border-slate-700 flex flex-wrap justify-between items-center gap-4">
                <select value={selectedBuildingId} onChange={e => setSelectedBuildingId(e.target.value)} className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full sm:w-64 p-2.5 dark:bg-slate-700 dark:border-slate-600">
                    <option value="">{t('housing.selectBuilding')}</option>
                    {buildings.map((b: Building) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                {canManage && <button onClick={() => onAdd(selectedBuildingId ? parseInt(selectedBuildingId, 10): undefined)} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"><i className="fas fa-plus me-2"></i>{t('housing.addFloor')}</button>}
            </div>
            {selectedBuildingId && (
            <>
                {numSelected > 0 && canManage && (
                    <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border-b dark:border-slate-700 flex items-center gap-4">
                        <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">{t('housing.floorsSelected', { count: numSelected })}</span>
                        <button onClick={onBulkDeleteClick} className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">{t('housing.bulkDelete')}</button>
                    </div>
                )}
                <div className="relative overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                         <thead className="text-sm text-slate-500 font-semibold bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                            <tr>
                                {canManage && <th scope="col" className="p-4"><input type="checkbox" ref={el => { if (el) { el.indeterminate = isIndeterminate; } }} checked={isAllSelected} onChange={handleSelectAll} className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500" aria-label={t('housing.selectAllFloors')} /></th>}
                                <th scope="col" className="px-6 py-3">{t('housing.floorNumber')}</th>
                                <th scope="col" className="px-6 py-3">{t('housing.description')}</th>
                                {canManage && <th scope="col" className="px-6 py-3">{t('actions')}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFloors.map((f: Floor) => (
                                <tr key={f.id} className={`border-b dark:border-slate-700 ${selectedFloors.has(f.id) ? 'bg-primary-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                                    {canManage && <td className="p-4"><input type="checkbox" checked={selectedFloors.has(f.id)} onChange={() => handleSelect(f.id)} className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500" aria-label={t('housing.selectFloor', {number: f.floorNumber})} /></td>}
                                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">{f.floorNumber}</td>
                                    <td className="px-6 py-4">{f.description}</td>
                                    {canManage && <td className="px-6 py-4"><button onClick={() => onEdit(f)} className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800">{t('edit')}</button></td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </>
            )}
        </div>
    );
};

const RoomsView = ({ buildings, floors, rooms, onAdd, onEdit, canManage, t, fetchData, selectedRooms, setSelectedRooms, onBulkStatusClick }: any) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { settings: exportSettings } = useExportSettings();
    const { language } = useLanguage();
    const [selectedBuildingId, setSelectedBuildingId] = useState<string>(buildings[0]?.id.toString() || '');
    const [selectedFloorId, setSelectedFloorId] = useState<string>('');
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    const [isExcelExporting, setIsExcelExporting] = useState(false);

    const availableFloors = useMemo(() => {
        if (!selectedBuildingId) return [];
        return floors.filter((f: Floor) => f.buildingId === parseInt(selectedBuildingId, 10));
    }, [floors, selectedBuildingId]);

    useEffect(() => {
        if (availableFloors.length > 0) {
            setSelectedFloorId(availableFloors[0].id.toString());
        } else {
            setSelectedFloorId('');
        }
    }, [selectedBuildingId, availableFloors]);

    useEffect(() => {
        // Clear selection when changing floor
        setSelectedRooms(new Set());
    }, [selectedFloorId, setSelectedRooms]);
    
    const filteredRooms = useMemo(() => {
        if(!selectedFloorId) return [];
        return rooms.filter((r: Room) => r.floorId === parseInt(selectedFloorId, 10));
    }, [rooms, selectedFloorId]);

    const handleToggleRoomStatus = async (room: Room, newStatus: 'available' | 'maintenance') => {
        if (room.currentOccupancy > 0 && newStatus === 'maintenance') {
            showToast(t('errors.roomOccupiedMaintenance'), 'error');
            return;
        }
        if (!window.confirm(t('housing.statusConfirm', { status: t(`statuses.${newStatus}`) }))) return;

        try {
            await roomApi.update(room.id, { status: newStatus });
            logActivity(user!.username, `Set room ${room.roomNumber} status to ${newStatus}`);
            showToast(t('housing.statusUpdated'), 'success');
            await fetchData();
        } catch (error) {
            showToast(t('errors.generic'), 'error');
        }
    };
    
    const getStatusBadge = (status: Room['status']) => {
        switch (status) {
            case 'available': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'occupied': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            case 'maintenance': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case 'reserved': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
            default: return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
        }
    };

    const getExportData = () => {
        if (!selectedBuildingId) return null;
        const building = buildings.find((b: Building) => b.id === parseInt(selectedBuildingId));
        if(!building) return null;

        const buildingFloors = floors.filter((f:Floor) => f.buildingId === building.id);
        const buildingFloorIds = new Set(buildingFloors.map((f:Floor) => f.id));
        const allRoomsInBuilding = rooms
            .filter((r:Room) => buildingFloorIds.has(r.floorId))
            .map((r:Room) => ({ ...r, floorNumber: buildingFloors.find((f:Floor) => f.id === r.floorId)?.floorNumber || ''}));
        
        const headers = [t('housing.floor'), t('housing.roomNumber'), t('housing.capacity'), t('housing.occupancy'), t('housing.status')];
        const data = allRoomsInBuilding.map((room: any) => [ room.floorNumber, room.roomNumber, room.capacity, room.currentOccupancy, t(`statuses.${room.status}`) ]);
        const title = `${t('housing.reportTitle')}: ${building.name}`;

        return { headers, data, title, buildingName: building.name };
    };

    const handlePdfExport = async () => {
        const exportData = getExportData();
        if (!exportData) return;
        setIsPdfExporting(true);
        showToast(t('exporting'), 'info');
        try {
            const { headers, data, title, buildingName } = exportData;
            const filename = `report_rooms_${buildingName.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            exportToPdf({ headers, data, title, filename, settings: exportSettings, language });
            logActivity(user!.username, `Exported room list for ${buildingName} to PDF`);
        } catch (error) {
            console.error("PDF Export failed:", error);
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsPdfExporting(false);
            setIsExportModalOpen(false);
        }
    };

    const handleExcelExport = async () => {
        const exportData = getExportData();
        if (!exportData) return;
        setIsExcelExporting(true);
        showToast(t('exporting'), 'info');
        try {
            const { headers, data, buildingName } = exportData;
            const filename = `report_rooms_${buildingName.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
            exportToExcel({ headers, data, filename, settings: exportSettings });
            logActivity(user!.username, `Exported room list for ${buildingName} to Excel`);
        } catch (error) {
            console.error("Excel Export failed:", error);
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsExcelExporting(false);
            setIsExportModalOpen(false);
        }
    };
    
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = new Set(filteredRooms.map((r: Room) => r.id));
            setSelectedRooms(allIds);
        } else {
            setSelectedRooms(new Set());
        }
    };

    const handleSelectRoom = (roomId: number) => {
        const newSelection = new Set(selectedRooms);
        if (newSelection.has(roomId)) {
            newSelection.delete(roomId);
        } else {
            newSelection.add(roomId);
        }
        setSelectedRooms(newSelection);
    };

    const numSelected = selectedRooms.size;
    const numTotalOnFloor = filteredRooms.length;
    const isAllSelected = numTotalOnFloor > 0 && numSelected === numTotalOnFloor;
    const isIndeterminate = numSelected > 0 && numSelected < numTotalOnFloor;
    
    const isExporting = isPdfExporting || isExcelExporting;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md">
            <div className="p-4 border-b dark:border-slate-700 flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-wrap items-center gap-4">
                     <select value={selectedBuildingId} onChange={e => setSelectedBuildingId(e.target.value)} className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full sm:w-auto p-2.5 dark:bg-slate-700 dark:border-slate-600">
                        <option value="">{t('housing.selectBuilding')}</option>
                        {buildings.map((b: Building) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    {selectedBuildingId && (
                         <select value={selectedFloorId} onChange={e => setSelectedFloorId(e.target.value)} className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full sm:w-auto p-2.5 dark:bg-slate-700 dark:border-slate-600">
                            <option value="">{t('housing.selectFloor')}</option>
                            {availableFloors.map((f: Floor) => <option key={f.id} value={f.id}>{f.floorNumber}</option>)}
                        </select>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {selectedBuildingId && (
                        <button onClick={() => setIsExportModalOpen(true)} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm disabled:opacity-50" disabled={isExporting}>
                            {isExporting ? <><i className="fas fa-spinner fa-spin me-2"></i>{t('exporting')}</> : <><i className="fas fa-download me-2"></i>{t('export')}</>}
                        </button>
                    )}
                    {canManage && selectedFloorId && <button onClick={() => onAdd(parseInt(selectedFloorId))} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"><i className="fas fa-plus me-2"></i>{t('housing.addRoom')}</button>}
                </div>
            </div>
             {selectedFloorId ? (
                <>
                {numSelected > 0 && canManage && (
                    <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border-b dark:border-slate-700 flex items-center gap-4">
                        <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">{t('housing.roomsSelected', { count: numSelected })}</span>
                        <button onClick={onBulkStatusClick} className="px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">{t('housing.changeStatus')}</button>
                    </div>
                )}
                <div className="relative overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                            <tr>
                                {canManage && <th scope="col" className="p-4"><input type="checkbox" ref={el => { if (el) { el.indeterminate = isIndeterminate; } }} checked={isAllSelected} onChange={handleSelectAll} className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600"/></th>}
                                <th scope="col" className="px-6 py-3">{t('housing.roomNumber')}</th>
                                <th scope="col" className="px-6 py-3">{t('housing.capacity')}</th>
                                <th scope="col" className="px-6 py-3">{t('housing.occupancy')}</th>
                                <th scope="col" className="px-6 py-3">{t('housing.status')}</th>
                                {canManage && <th scope="col" className="px-6 py-3">{t('actions')}</th>}
                            </tr>
                        </thead>
                        <tbody>
                        {filteredRooms.map((room: Room) => (
                             <tr key={room.id} className={`border-b dark:border-slate-700 ${selectedRooms.has(room.id) ? 'bg-primary-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                                {canManage && <td className="p-4"><input type="checkbox" checked={selectedRooms.has(room.id)} onChange={() => handleSelectRoom(room.id)} className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600"/></td>}
                                <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">{room.roomNumber}</th>
                                <td className="px-6 py-4">{room.capacity}</td>
                                <td className="px-6 py-4">{room.currentOccupancy}</td>
                                <td className="px-6 py-4"><span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(room.status)}`}>{t(`statuses.${room.status}`)}</span></td>
                                {canManage && (
                                    <td className="px-6 py-4 space-x-2 rtl:space-x-reverse whitespace-nowrap">
                                        <button onClick={() => handleToggleRoomStatus(room, room.status === 'available' ? 'maintenance' : 'available')} title={t('housing.toggleMaintenance')} className="text-slate-400 hover:text-yellow-600 disabled:text-slate-300 disabled:cursor-not-allowed" disabled={room.status==='occupied' || room.status==='reserved'}><i className="fas fa-tools"></i></button>
                                        <button onClick={() => onEdit(room)} title={t('edit')} className="text-slate-400 hover:text-primary-600"><i className="fas fa-pencil-alt"></i></button>
                                    </td>
                                )}
                            </tr>
                        ))}
                         {filteredRooms.length === 0 && <tr><td colSpan={canManage ? 6 : 5} className="text-center py-4 text-slate-500">{t('housing.noRooms')}</td></tr>}
                        </tbody>
                    </table>
                </div>
                </>
             ) : (
                <p className="p-4 text-slate-500">{t('housing.selectFloorPrompt')}</p>
             )}
             <ExportOptionsModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                onExportPdf={handlePdfExport}
                onExportExcel={handleExcelExport}
                isPdfExporting={isPdfExporting}
                isExcelExporting={isExcelExporting}
            />
        </div>
    );
}

export default BuildingsAndRoomsPage;