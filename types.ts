

// FIX: Define and export all application types in this file to serve as a single source of truth for data structures.

export interface User {
  id: number;
  username: string;
  roles: ('super_admin' | 'admin' | 'hr' | 'viewer' | 'supervisor' | 'manager' | 'maintenance')[];
  status: 'active' | 'inactive';
}

export interface Building {
  id: number;
  name: string;
  location: string;
  capacity: number;
  status: 'active' | 'inactive';
}

export interface Floor {
    id: number;
    buildingId: number;
    floorNumber: string;
    description: string;
}

export interface Room {
    id: number;
    floorId: number;
    roomNumber: string;
    capacity: number;
    currentOccupancy: number;
    status: 'available' | 'occupied' | 'maintenance' | 'reserved';
}

export interface Employee {
    id: number;
    employeeId: string;
    firstName: string;
    lastName: string;
    nationalId: string;
    jobTitle: string;
    phone: string;
    department: string;
    status: 'active' | 'left';
    contractEndDate: string;
}

export interface Assignment {
    id: number;
    employeeId: number;
    roomId: number;
    checkInDate: string;
    expectedCheckOutDate: string | null;
    checkOutDate: string | null;
}

export interface MaintenanceRequest {
    id: number;
    roomId: number;
    problemType: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved';
    reportedAt: string;
}

export interface ActivityLog {
    id: number;
    username: string;
    action: string;
    timestamp: string;
}

export interface ReservationGuest {
    firstName: string;
    lastName: string;
    guestIdCardNumber: string;
    guestPhone: string;
}

export interface Reservation {
    id: number;
    roomId: number;
    firstName: string;
    lastName: string;
    checkInDate: string;
    checkOutDate: string | null;
    notes: string;
    guestIdCardNumber: string;
    guestPhone: string;
    jobTitle: string;
    department: string;
    guests: string; // JSON string of ReservationGuest[]
}

export interface Hosting {
    id: number;
    employeeId: number; // The host employee
    guestFirstName: string; // Primary Guest
    guestLastName: string; // Primary Guest
    startDate: string;
    endDate: string;
    notes: string | null;
    status: 'active' | 'completed' | 'cancelled';
    guests: string; // JSON string of ReservationGuest[]
}


export const departmentJobTitles: Record<string, string[]> = {
    reception: ['Manager', 'Supervisor', 'Agent', 'Clerk'],
    reservations: ['Manager', 'Supervisor', 'Agent', 'Clerk'],
    public_relations: ['Manager', 'Specialist', 'Coordinator'],
    concierge: ['Chief Concierge', 'Concierge', 'Bell Captain', 'Bellman'],
    housekeeping: ['Executive Housekeeper', 'Assistant Housekeeper', 'Supervisor', 'Room Attendant', 'Public Area Attendant'],
    laundry: ['Manager', 'Supervisor', 'Valet', 'Presser', 'Washer'],
    security_safety: ['Director', 'Manager', 'Supervisor', 'Officer'],
    food_beverage: ['Director', 'Manager', 'Supervisor', 'Captain', 'Waiter/Waitress', 'Host/Hostess', 'Bartender'],
    kitchen: ['Executive Chef', 'Sous Chef', 'Chef de Partie', 'Commis Chef', 'Steward'],
    maintenance_engineering: ['Chief Engineer', 'Assistant Chief Engineer', 'Supervisor', 'Technician (Plumbing, Electrical, HVAC)'],
    it: ['Cluster', 'Manager', 'Assistant', 'Supervisor', 'Clerk'],
    hr: ['Director', 'Manager', 'Specialist', 'Coordinator', 'Assistant'],
    admin_affairs: ['Manager', 'Coordinator', 'Clerk'],
    finance_accounting: ['Director of Finance', 'Controller', 'Accountant', 'Accounts Payable/Receivable', 'Auditor'],
    purchasing: ['Manager', 'Buyer', 'Clerk'],
    stores: ['Manager', 'Storekeeper', 'Clerk'],
    transportation: ['Manager', 'Supervisor', 'Driver'],
    general_cleaning: ['Supervisor', 'Cleaner'],
    sales: ['Director of Sales', 'Sales Manager', 'Sales Executive', 'Coordinator'],
    marketing: ['Director of Marketing', 'Marketing Manager', 'Marketing Executive', 'Digital Marketing Specialist'],
    tour_programs: ['Manager', 'Coordinator', 'Specialist'],
    flight_reservations: ['Manager', 'Supervisor', 'Agent'],
    tour_guides: ['Senior Guide', 'Guide'],
    tourist_transport: ['Manager', 'Supervisor', 'Driver', 'Coordinator'],
    international_relations: ['Manager', 'Specialist', 'Coordinator'],
    housing_section: ['Manager', 'Supervisor', 'Coordinator', 'Clerk']
};

export const DEPARTMENTS = Object.keys(departmentJobTitles);