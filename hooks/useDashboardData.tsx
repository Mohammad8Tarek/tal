import { useState, useEffect } from 'react';
import { employeeApi, roomApi, maintenanceApi, assignmentApi, buildingApi, userApi, activityLogApi, floorApi } from '../services/apiService';
import { Employee, Room, MaintenanceRequest, Building, Assignment, User, ActivityLog, Floor } from '../types';

// Define the shape of the data this hook will return
export interface DashboardData {
    // Raw data
    employees: Employee[];
    rooms: Room[];
    maintenanceRequests: MaintenanceRequest[];
    buildings: Building[];
    assignments: Assignment[];
    users: User[];
    activityLogs: ActivityLog[];
    floors: Floor[];
    
    // Calculated stats
    stats: {
        totalEmployees: number;
        activeEmployees: number;
        unhousedEmployees: number;
        totalRooms: number;
        totalBuildings: number;
        occupiedRooms: number;
        availableRooms: number;
        occupancyRate: number;
        openMaintenance: number;
        expiringContracts: Employee[];
    };

    // Data for charts
    charts: {
        occupancyByBuilding: { name: string; occupancy: number; total: number }[];
        employeeDistributionByDept: { name: string; value: number }[];
        userRoleDistribution: { name: string; value: number }[];
        maintenanceStatusDistribution: { name: string; value: number }[];
    };
}

const useDashboardData = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [employees, rooms, maintenanceRequests, buildings, assignments, users, activityLogs, floors] = await Promise.all([
                    employeeApi.getAll(),
                    roomApi.getAll(),
                    maintenanceApi.getAll(),
                    buildingApi.getAll(),
                    assignmentApi.getAll(),
                    userApi.getAll(),
                    activityLogApi.getAll(),
                    floorApi.getAll(),
                ]);

                // --- CALCULATIONS ---

                // Stats
                const activeEmployees = employees.filter(e => e.status === 'active');
                const housedEmployeeIds = new Set(assignments.filter(a => !a.checkOutDate).map(a => a.employeeId));
                const unhousedEmployees = activeEmployees.filter(e => !housedEmployeeIds.has(e.id)).length;
                const occupiedOrReservedRooms = rooms.filter(r => r.status === 'occupied' || r.status === 'reserved').length;
                const availableRooms = rooms.filter(r => r.status === 'available').length;
                const occupancyRate = rooms.length > 0 ? Math.round((occupiedOrReservedRooms / rooms.length) * 100) : 0;
                
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Normalize today's date
                const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                
                const expiringContracts = activeEmployees.filter(e => {
                    const contractDate = new Date(e.contractEndDate);
                    return contractDate <= thirtyDaysFromNow;
                });


                // Chart data
                const floorToBuildingMap = new Map(floors.map(f => [f.id, f.buildingId]));
                const occupancyByBuilding = buildings.map(building => {
                    const buildingRooms = rooms.filter(r => floorToBuildingMap.get(r.floorId) === building.id);
                    const occupied = buildingRooms.filter(r => r.status === 'occupied' || r.status === 'reserved').length;
                    return { name: building.name, occupancy: occupied, total: buildingRooms.length };
                });

                // FIX: Add explicit type for accumulator in reduce to avoid `unknown` type for value.
                const employeeDistributionByDept = activeEmployees.reduce((acc: Record<string, number>, emp) => {
                    acc[emp.department] = (acc[emp.department] || 0) + 1;
                    return acc;
                }, {});

                // FIX: Add explicit type for accumulator in reduce to avoid `unknown` type for value.
                const maintenanceStatusDistribution = maintenanceRequests.reduce((acc: Record<string, number>, req) => {
                    acc[req.status] = (acc[req.status] || 0) + 1;
                    return acc;
                }, {});

                // FIX: Add explicit type for accumulator in reduce to avoid `unknown` type for value.
                const userRoleDistribution = users.reduce((acc: Record<string, number>, user) => {
                    user.roles.forEach(role => {
                        acc[role] = (acc[role] || 0) + 1;
                    });
                    return acc;
                }, {});


                setData({
                    employees, rooms, maintenanceRequests, buildings, assignments, users, activityLogs, floors,
                    stats: {
                        totalEmployees: employees.length,
                        activeEmployees: activeEmployees.length,
                        unhousedEmployees,
                        totalRooms: rooms.length,
                        totalBuildings: buildings.length,
                        occupiedRooms: occupiedOrReservedRooms,
                        availableRooms,
                        occupancyRate,
                        openMaintenance: maintenanceRequests.filter(m => m.status === 'open' || m.status === 'in_progress').length,
                        expiringContracts,
                    },
                    charts: {
                        occupancyByBuilding,
                        employeeDistributionByDept: Object.entries(employeeDistributionByDept).map(([name, value]) => ({ name, value })),
                        userRoleDistribution: Object.entries(userRoleDistribution).map(([name, value]) => ({ name, value })),
                        maintenanceStatusDistribution: Object.entries(maintenanceStatusDistribution).map(([name, value]) => ({ name, value })),
                    }
                });
            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return { data, loading };
};

export default useDashboardData;