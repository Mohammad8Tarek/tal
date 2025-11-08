import { User, Building, Floor, Room, Employee, Assignment, MaintenanceRequest, ActivityLog, Reservation, Hosting } from '../types';

declare var initSqlJs: any;

// --- Database Core ---
const DB_NAME = 'tal-avenue-housing.sqlite';
const DB_VERSION = 8;
const BACKUP_PREFIX = 'backup-';
const MAX_BACKUPS = 5;

let db: any;
let dbInitialized: Promise<void> | null = null;
let writeCounter = 0;

const openIndexedDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SQLiteDB', 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('files');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveDataToIndexedDB = (idb: IDBDatabase, key: string, data: Uint8Array): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = idb.transaction('files', 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.put(data, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const loadDataFromIndexedDB = (idb: IDBDatabase, key: string): Promise<Uint8Array | null> => {
    return new Promise((resolve, reject) => {
        const transaction = idb.transaction('files', 'readonly');
        const store = transaction.objectStore('files');
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

const deleteDataFromIndexedDB = (idb: IDBDatabase, key: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const transaction = idb.transaction('files', 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const saveDatabase = async () => {
    if (db) {
        const idb = await openIndexedDB();
        const data = db.export();
        await saveDataToIndexedDB(idb, DB_NAME, data);
        idb.close();
        writeCounter++;
        if (writeCounter > 50) { // Auto-backup after 50 writes
            await backupDatabase();
            writeCounter = 0;
        }
    }
};

const backupDatabase = async () => {
    if (!db) return;
    const timestamp = new Date().toISOString();
    const backupKey = `${BACKUP_PREFIX}${DB_NAME}-${timestamp}`;
    
    console.log(`Creating database backup: ${backupKey}`);
    
    const idb = await openIndexedDB();
    const data = db.export();
    await saveDataToIndexedDB(idb, backupKey, data);
    
    // Update last backup time
    await executeQuery(`UPDATE SystemVariables SET value = ? WHERE key = 'last_backup_time'`, [timestamp]);
    
    // Clean up old backups
    const tx = idb.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    const request = store.getAllKeys();
    request.onsuccess = () => {
        const keys = request.result.filter(k => (k as string).startsWith(BACKUP_PREFIX)).sort().reverse();
        if (keys.length > MAX_BACKUPS) {
            for (let i = MAX_BACKUPS; i < keys.length; i++) {
                console.log(`Deleting old backup: ${keys[i]}`);
                store.delete(keys[i]);
            }
        }
    };
    idb.close();
};

const dbToObjects = (result: any[]): any[] => {
    if (!result || result.length === 0) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj: { [key: string]: any } = {};
        columns.forEach((col, i) => {
            obj[col] = row[i];
        });
        return obj;
    });
};

const executeQuery = async (sql: string, params: any[] = []): Promise<any[]> => {
    await dbInitialized;
    try {
        const results = db.exec(sql, params);
        const isWrite = /^(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sql);
        if (isWrite) {
            await saveDatabase();
        }
        return dbToObjects(results);
    } catch (e) {
        console.error("Query failed:", sql, params, e);
        throw e;
    }
};

const executeNonQuery = async (sql: string, params: any[] = []): Promise<void> => {
     await dbInitialized;
    try {
        db.run(sql, params);
        await saveDatabase();
    } catch (e) {
        console.error("Query failed:", sql, params, e);
        throw e;
    }
}

// --- Schema and Migrations ---
const SCHEMA_VERSION_1 = [
    `CREATE TABLE SystemVariables (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
    `CREATE TABLE Users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, roles TEXT, status TEXT);`,
    `CREATE TABLE Buildings (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, location TEXT, capacity INTEGER, status TEXT);`,
    `CREATE TABLE Floors (id INTEGER PRIMARY KEY AUTOINCREMENT, buildingId INTEGER, floorNumber TEXT, description TEXT, FOREIGN KEY(buildingId) REFERENCES Buildings(id));`,
    `CREATE TABLE Rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, floorId INTEGER, roomNumber TEXT, capacity INTEGER, currentOccupancy INTEGER, status TEXT, FOREIGN KEY(floorId) REFERENCES Floors(id));`,
    `CREATE TABLE Employees (id INTEGER PRIMARY KEY AUTOINCREMENT, fullName TEXT, nationalId TEXT UNIQUE, phone TEXT, department TEXT, status TEXT, contractEndDate TEXT);`,
    `CREATE TABLE Assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, employeeId INTEGER, roomId INTEGER, checkInDate TEXT, expectedCheckOutDate TEXT, checkOutDate TEXT, FOREIGN KEY(employeeId) REFERENCES Employees(id), FOREIGN KEY(roomId) REFERENCES Rooms(id));`,
    `CREATE TABLE MaintenanceRequests (id INTEGER PRIMARY KEY AUTOINCREMENT, roomId INTEGER, problemType TEXT, description TEXT, status TEXT, reportedAt TEXT, FOREIGN KEY(roomId) REFERENCES Rooms(id));`,
    `CREATE TABLE Reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, roomId INTEGER, guestName TEXT, checkInDate TEXT, checkOutDate TEXT, notes TEXT, guestIdCardNumber TEXT, guestPhone TEXT, guestPosition TEXT, department TEXT, FOREIGN KEY(roomId) REFERENCES Rooms(id));`,
    `CREATE TABLE ActivityLog (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, action TEXT, timestamp TEXT);`
];

const SCHEMA_VERSION_2 = [
    `ALTER TABLE Employees ADD COLUMN jobTitle TEXT DEFAULT '';`,
    `ALTER TABLE Reservations RENAME COLUMN guestPosition TO jobTitle;`,
];

const SCHEMA_VERSION_3 = [
    `ALTER TABLE Reservations ADD COLUMN department TEXT DEFAULT '';`,
];

const SCHEMA_VERSION_4 = [
    `ALTER TABLE Employees RENAME COLUMN fullName TO firstName;`,
    `ALTER TABLE Employees ADD COLUMN lastName TEXT DEFAULT '';`,
    `UPDATE Employees SET lastName = SUBSTR(firstName, INSTR(firstName, ' ') + 1), firstName = SUBSTR(firstName, 1, INSTR(firstName, ' ') - 1) WHERE INSTR(firstName, ' ') > 0;`
];

const SCHEMA_VERSION_5 = [
    `ALTER TABLE Employees ADD COLUMN employeeId TEXT;`,
    `UPDATE Employees SET employeeId = 'EMP001' WHERE nationalId = '123456789';`,
    `UPDATE Employees SET employeeId = 'EMP002' WHERE nationalId = '987654321';`,
    `UPDATE Employees SET employeeId = 'EMP003' WHERE nationalId = '112233445';`,
];

const SCHEMA_VERSION_6 = [
    `ALTER TABLE Reservations RENAME COLUMN guestName TO firstName;`,
    `ALTER TABLE Reservations ADD COLUMN lastName TEXT DEFAULT '';`,
    `UPDATE Reservations SET lastName = SUBSTR(firstName, INSTR(firstName, ' ') + 1), firstName = SUBSTR(firstName, 1, INSTR(firstName, ' ') - 1) WHERE INSTR(firstName, ' ') > 0;`
];

const SCHEMA_VERSION_7 = [
    `CREATE TABLE Hostings (id INTEGER PRIMARY KEY AUTOINCREMENT, employeeId INTEGER, guestFirstName TEXT, guestLastName TEXT, guestIdCardNumber TEXT, startDate TEXT, endDate TEXT, notes TEXT, status TEXT, FOREIGN KEY(employeeId) REFERENCES Employees(id));`,
    `ALTER TABLE Reservations ADD COLUMN guests TEXT DEFAULT '[]';`
];

const SCHEMA_VERSION_8 = [
    `ALTER TABLE Hostings ADD COLUMN guests TEXT DEFAULT '[]';`
];


const runMigrations = async (currentVersion: number) => {
    if (currentVersion < 1) {
        console.log("Applying version 1 schema...");
        SCHEMA_VERSION_1.forEach(stmt => db.run(stmt));
        await seedInitialData();
        db.run(`INSERT OR REPLACE INTO SystemVariables (key, value) VALUES ('version', ?)`, [1]);
        db.run(`INSERT OR REPLACE INTO SystemVariables (key, value) VALUES ('default_language', 'en')`);
        db.run(`INSERT OR REPLACE INTO SystemVariables (key, value) VALUES ('ai_suggestions', 'false')`);
        console.log("Database schema version 1 applied and data seeded.");
        currentVersion = 1;
    }
    if (currentVersion < 2) {
        console.log("Applying version 2 schema...");
        SCHEMA_VERSION_2.forEach(stmt => db.run(stmt));
        db.run(`UPDATE Employees SET jobTitle = 'IT Specialist' WHERE id = 1;`);
        db.run(`UPDATE Employees SET jobTitle = 'HR Coordinator' WHERE id = 2;`);
        db.run(`UPDATE Employees SET jobTitle = 'Housekeeper' WHERE id = 3;`);
        db.run(`INSERT OR REPLACE INTO SystemVariables (key, value) VALUES ('version', ?)`, [2]);
        console.log("Database schema version 2 applied.");
        currentVersion = 2;
    }
    if (currentVersion < 3) {
        console.log("Applying version 3 schema...");
        try {
            // This might fail if the column already exists from a fresh v1 schema, so we wrap it.
            db.run(SCHEMA_VERSION_3[0]);
        } catch (e) {
            console.warn("Could not add 'department' column to Reservations, it likely already exists.");
        }
        db.run(`UPDATE Reservations SET department = 'marketing' WHERE id = 1;`);
        db.run(`UPDATE Reservations SET jobTitle = 'Consultant' WHERE id = 1;`);
        db.run(`INSERT OR REPLACE INTO SystemVariables (key, value) VALUES ('version', ?)`, [3]);
        console.log("Database schema version 3 applied.");
        currentVersion = 3;
    }
    if (currentVersion < 4) {
        console.log("Applying version 4 schema...");
        SCHEMA_VERSION_4.forEach(stmt => db.run(stmt));
        db.run(`INSERT OR REPLACE INTO SystemVariables (key, value) VALUES ('version', ?)`, [4]);
        console.log("Database schema version 4 applied.");
        currentVersion = 4;
    }
    if (currentVersion < 5) {
        console.log("Applying version 5 schema...");
        SCHEMA_VERSION_5.forEach(stmt => db.run(stmt));
        db.run(`INSERT OR REPLACE INTO SystemVariables (key, value) VALUES ('version', ?)`, [5]);
        console.log("Database schema version 5 applied.");
        currentVersion = 5;
    }
    if (currentVersion < 6) {
        console.log("Applying version 6 schema...");
        SCHEMA_VERSION_6.forEach(stmt => db.run(stmt));
        db.run(`INSERT OR REPLACE INTO SystemVariables (key, value) VALUES ('version', ?)`, [6]);
        console.log("Database schema version 6 applied.");
        currentVersion = 6;
    }
    if (currentVersion < 7) {
        console.log("Applying version 7 schema...");
        SCHEMA_VERSION_7.forEach(stmt => db.run(stmt));
         // Migrate existing reservations data to the new guests column
        const existingReservations = dbToObjects(db.exec(`SELECT id, firstName, lastName, guestIdCardNumber, guestPhone FROM Reservations WHERE guests = '[]'`));
        if (existingReservations.length > 0) {
            console.log(`Migrating ${existingReservations.length} existing reservations to new guests format...`);
            const stmt = db.prepare('UPDATE Reservations SET guests = ? WHERE id = ?');
            for (const res of existingReservations) {
                if (res.firstName) { // check if there is a guest
                    const guest = {
                        firstName: res.firstName,
                        lastName: res.lastName || '',
                        guestIdCardNumber: res.guestIdCardNumber || '',
                        guestPhone: res.guestPhone || '',
                    };
                    stmt.run([JSON.stringify([guest]), res.id]);
                }
            }
            stmt.free();
        }
        db.run(`INSERT OR REPLACE INTO SystemVariables (key, value) VALUES ('version', ?)`, [7]);
        console.log("Database schema version 7 applied.");
        currentVersion = 7;
    }
    if (currentVersion < 8) {
        console.log("Applying version 8 schema...");
        SCHEMA_VERSION_8.forEach(stmt => db.run(stmt));
        
        // Migrate existing hosting data to the new guests column
        const existingHostings = dbToObjects(db.exec(`SELECT id, guestFirstName, guestLastName, guestIdCardNumber FROM Hostings WHERE guests = '[]'`));
        if (existingHostings.length > 0) {
            console.log(`Migrating ${existingHostings.length} existing hostings to new guests format...`);
            const stmt = db.prepare('UPDATE Hostings SET guests = ? WHERE id = ?');
            for (const h of existingHostings) {
                const guest = {
                    firstName: h.guestFirstName,
                    lastName: h.guestLastName || '',
                    guestIdCardNumber: h.guestIdCardNumber || '',
                    guestPhone: '', // phone was not stored before
                };
                stmt.run([JSON.stringify([guest]), h.id]);
            }
            stmt.free();
        }

        db.run(`INSERT OR REPLACE INTO SystemVariables (key, value) VALUES ('version', ?)`, [8]);
        console.log("Database schema version 8 applied.");
        currentVersion = 8;
    }
};

export const initDb = () => {
    if (dbInitialized) return dbInitialized;
    dbInitialized = new Promise(async (resolve, reject) => {
        try {
            const SQL = await initSqlJs({ locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}` });
            const idb = await openIndexedDB();
            const dbFile = await loadDataFromIndexedDB(idb, DB_NAME);
            if (dbFile) {
                console.log("Loading database from IndexedDB...");
                db = new SQL.Database(dbFile);
            } else {
                console.log("Creating new database...");
                db = new SQL.Database();
            }
            idb.close();

            let currentVersion = 0;
            try {
                const res = db.exec(`SELECT value FROM SystemVariables WHERE key = 'version'`);
                if (res.length > 0 && res[0].values.length > 0) {
                    currentVersion = parseInt(res[0].values[0][0], 10);
                }
            } catch (e) {
                // SystemVariables table likely doesn't exist yet
                console.log("SystemVariables table not found, initializing schema.");
            }

            if (currentVersion < DB_VERSION) {
                await runMigrations(currentVersion);
            }
            
            await saveDatabase();
            resolve();
        } catch (e) {
            reject(e);
        }
    });
    return dbInitialized;
};


// --- Initial Mock Data ---
const initialUsers: (Omit<User, 'id'> & {password: string})[] = [
    { username: 'admin', password: 'admin', roles: ['admin'], status: 'active' },
    { username: 'manager', password: 'password', roles: ['manager'], status: 'active' },
    { username: 'supervisor', password: 'password', roles: ['supervisor'], status: 'active' },
    { username: 'hr', password: 'password', roles: ['hr'], status: 'active' },
    { username: 'maintenance', password: 'password', roles: ['maintenance'], status: 'active' },
    { username: 'viewer', password: 'password', roles: ['viewer'], status: 'inactive' },
    { username: 'hr_supervisor', password: 'password', roles: ['hr', 'supervisor'], status: 'active' },
    { username: 'superadmin', password: 'superadmin', roles: ['super_admin'], status: 'active' },
];
const initialBuildings: Building[] = [
    { id: 1, name: 'A-Block', location: 'North Wing', capacity: 150, status: 'active' },
    { id: 2, name: 'B-Block', location: 'South Wing', capacity: 120, status: 'active' },
];
const initialFloors: Floor[] = [
    { id: 1, buildingId: 1, floorNumber: 'G', description: 'Ground Floor' },
    { id: 2, buildingId: 1, floorNumber: '1', description: 'First Floor' },
    { id: 3, buildingId: 2, floorNumber: 'G', description: 'Ground Floor' },
];
const initialRooms: Room[] = [
    { id: 1, floorId: 1, roomNumber: 'A-G01', capacity: 2, currentOccupancy: 1, status: 'occupied' },
    { id: 2, floorId: 1, roomNumber: 'A-G02', capacity: 2, currentOccupancy: 0, status: 'available' },
    { id: 3, floorId: 2, roomNumber: 'A-101', capacity: 1, currentOccupancy: 0, status: 'maintenance' },
    { id: 4, floorId: 3, roomNumber: 'B-G01', capacity: 2, currentOccupancy: 0, status: 'available' },
];
const initialEmployees: Omit<Employee, 'id'>[] = [
    { employeeId: 'EMP001', firstName: 'John', lastName: 'Doe', nationalId: '123456789', jobTitle: 'IT Specialist', phone: '555-0101', department: 'it', status: 'active', contractEndDate: '2025-12-31T00:00:00.000Z' },
    { employeeId: 'EMP002', firstName: 'Jane', lastName: 'Smith', nationalId: '987654321', jobTitle: 'HR Coordinator', phone: '555-0102', department: 'hr', status: 'active', contractEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() },
    { employeeId: 'EMP003', firstName: 'Peter', lastName: 'Jones', nationalId: '112233445', jobTitle: 'Housekeeper', phone: '555-0103', department: 'housekeeping', status: 'left', contractEndDate: '2023-01-01T00:00:00.000Z' },
];
const initialAssignments: Omit<Assignment, 'id'>[] = [
    { employeeId: 1, roomId: 1, checkInDate: '2023-10-01T10:00:00.000Z', expectedCheckOutDate: '2024-12-31T10:00:00.000Z', checkOutDate: null },
];
const initialMaintenance: Omit<MaintenanceRequest, 'id'>[] = [
    { roomId: 3, problemType: 'Plumbing', description: 'Leaky faucet', status: 'in_progress', reportedAt: '2024-07-20T14:30:00.000Z' },
    { roomId: 2, problemType: 'Electrical', description: 'Light fixture not working', status: 'open', reportedAt: new Date().toISOString() },
];
const initialReservations: (Omit<Reservation, 'id' | 'firstName' | 'lastName' | 'guests'> & { guestName: string })[] = [
    { roomId: 4, guestName: 'Guest Tester', checkInDate: '2024-09-01T12:00:00.000Z', checkOutDate: '2024-09-15T12:00:00.000Z', notes: 'VIP Guest', guestIdCardNumber: 'G12345', guestPhone: '555-GUEST', jobTitle: 'Consultant', department: 'marketing' }
];

const seedInitialData = async () => {
    initialUsers.forEach(user => db.run(`INSERT INTO Users (username, password, roles, status) VALUES (?, ?, ?, ?)`, [user.username, user.password, JSON.stringify(user.roles), user.status]));
    initialBuildings.forEach(b => db.run(`INSERT INTO Buildings (id, name, location, capacity, status) VALUES (?, ?, ?, ?, ?)`, [b.id, b.name, b.location, b.capacity, b.status]));
    initialFloors.forEach(f => db.run(`INSERT INTO Floors (id, buildingId, floorNumber, description) VALUES (?, ?, ?, ?)`, [f.id, f.buildingId, f.floorNumber, f.description]));
    initialRooms.forEach(r => db.run(`INSERT INTO Rooms (id, floorId, roomNumber, capacity, currentOccupancy, status) VALUES (?, ?, ?, ?, ?, ?)`, [r.id, r.floorId, r.roomNumber, r.capacity, r.currentOccupancy, r.status]));
    initialEmployees.forEach(e => db.run(`INSERT INTO Employees (fullName, nationalId, phone, department, status, contractEndDate) VALUES (?, ?, ?, ?, ?, ?)`, [`${e.firstName} ${e.lastName}`, e.nationalId, e.phone, e.department, e.status, e.contractEndDate]));
    initialAssignments.forEach(a => db.run(`INSERT INTO Assignments (employeeId, roomId, checkInDate, expectedCheckOutDate, checkOutDate) VALUES (?, ?, ?, ?, ?)`, [a.employeeId, a.roomId, a.checkInDate, a.expectedCheckOutDate, a.checkOutDate]));
    initialMaintenance.forEach(m => db.run(`INSERT INTO MaintenanceRequests (roomId, problemType, description, status, reportedAt) VALUES (?, ?, ?, ?, ?)`, [m.roomId, m.problemType, m.description, m.status, m.reportedAt]));
    initialReservations.forEach(r => db.run(`INSERT INTO Reservations (roomId, guestName, checkInDate, checkOutDate, notes, guestIdCardNumber, guestPhone, guestPosition, department) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [r.roomId, r.guestName, r.checkInDate, r.checkOutDate, r.notes, r.guestIdCardNumber, r.guestPhone, r.jobTitle, r.department]));
};

// --- API Service Factory ---
const createApiService = <T extends { id: number }>(tableName: string) => {
    return {
        getAll: (): Promise<T[]> => executeQuery(`SELECT * FROM ${tableName}`) as Promise<T[]>,
        getById: async (id: number): Promise<T | undefined> => {
            const results = await executeQuery(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
            return results[0] as T | undefined;
        },
        create: async (data: Omit<T, 'id'>): Promise<T> => {
            const columns = Object.keys(data);
            const values = Object.values(data);
            const placeholders = columns.map(() => '?').join(', ');
            const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
            await executeNonQuery(sql, values);
            const newRecord = await executeQuery(`SELECT * FROM ${tableName} WHERE rowid = last_insert_rowid()`);
            return newRecord[0] as T;
        },
        update: async (id: number, data: Partial<Omit<T, 'id'>>): Promise<T> => {
            const columns = Object.keys(data);
            const values = Object.values(data);
            const setClause = columns.map(col => `${col} = ?`).join(', ');
            const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;
            await executeNonQuery(sql, [...values, id]);
            return (await executeQuery(`SELECT * FROM ${tableName} WHERE id = ?`, [id]))[0] as T;
        },
        delete: (id: number): Promise<void> => executeNonQuery(`DELETE FROM ${tableName} WHERE id = ?`, [id]),
    };
};


// --- Activity Log ---
export const logActivity = async (username: string, action: string): Promise<ActivityLog> => {
    const newLogData = { username, action, timestamp: new Date().toISOString() };
    const columns = Object.keys(newLogData);
    const values = Object.values(newLogData);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ActivityLog (${columns.join(', ')}) VALUES (${placeholders})`;
    await executeNonQuery(sql, values);
    const newLog = await executeQuery(`SELECT * FROM ActivityLog WHERE rowid = last_insert_rowid()`);
    return newLog[0];
};
export const activityLogApi = createApiService<ActivityLog>('ActivityLog');

// --- Auth ---
export const authApi = {
    login: async ({ username, password }: { username: string, password: string }): Promise<{ user: User, token: string }> => {
        await dbInitialized;
        return new Promise(async (resolve, reject) => {
            const results = await executeQuery(`SELECT * FROM Users WHERE username = ?`, [username]);
            if (results.length === 0) {
                logActivity(username, `Failed login attempt: invalid credentials`);
                return reject(new Error("Invalid username or password"));
            }
            const user: User & {password: string} = {...results[0], roles: JSON.parse(results[0].roles)};

            if (user.status === 'inactive') {
                logActivity(username, `Failed login attempt: account inactive`);
                return reject(new Error("Account is inactive."));
            }
            
            if (user.password === password) {
                // In a real app, you would verify a hash here
                const token = `fake-token-for-${username}`;
                await executeQuery(`INSERT OR REPLACE INTO SystemVariables (key, value) VALUES ('last_login_user', ?)`, [username]);
                const { password: _, ...userWithoutPassword } = user;
                resolve({ user: userWithoutPassword, token });
            } else {
                logActivity(username, `Failed login attempt: invalid credentials`);
                reject(new Error("Invalid username or password"));
            }
        });
    }
};

// --- Custom User API ---
const userApi = {
    getAll: async (): Promise<User[]> => {
        const users = await executeQuery(`SELECT id, username, roles, status FROM Users`);
        return users.map(u => ({...u, roles: JSON.parse(u.roles)}));
    },
    getById: async (id: number): Promise<User | undefined> => {
        const results = await executeQuery(`SELECT id, username, roles, status FROM Users WHERE id = ?`, [id]);
        if (results.length > 0) {
            return {...results[0], roles: JSON.parse(results[0].roles)};
        }
        return undefined;
    },
    create: async (data: Omit<User, 'id'> & { password?: string }): Promise<User> => {
        const { username, password, roles, status } = data;
        if (!password) throw new Error("Password is required");
        await executeNonQuery(`INSERT INTO Users (username, password, roles, status) VALUES (?, ?, ?, ?)`, [username, password, JSON.stringify(roles), status]);
        const newUser = await executeQuery(`SELECT id, username, roles, status FROM Users WHERE rowid = last_insert_rowid()`);
        return {...newUser[0], roles: JSON.parse(newUser[0].roles)};
    },
    update: async (id: number, data: Partial<Omit<User, 'id'>> & { password?: string }): Promise<User> => {
        const { password, ...rest } = data;
        if (Object.keys(rest).length > 0) {
            const columns = Object.keys(rest);
            const values = Object.values(rest).map(v => Array.isArray(v) ? JSON.stringify(v) : v);
            const setClause = columns.map(col => `${col} = ?`).join(', ');
            await executeNonQuery(`UPDATE Users SET ${setClause} WHERE id = ?`, [...values, id]);
        }
        if (password) {
            await executeNonQuery(`UPDATE Users SET password = ? WHERE id = ?`, [password, id]);
        }
        const updatedUser = await executeQuery(`SELECT id, username, roles, status FROM Users WHERE id = ?`, [id]);
        return {...updatedUser[0], roles: JSON.parse(updatedUser[0].roles)};
    },
    delete: (id: number): Promise<void> => executeNonQuery(`DELETE FROM Users WHERE id = ?`, [id]),
};

// --- Test Utility ---
export const resetDatabase = async () => {
    if (db) {
        db.close();
        db = null;
    }
    const idb = await openIndexedDB();
    await deleteDataFromIndexedDB(idb, DB_NAME);
    idb.close();
    dbInitialized = null;
    await initDb();
};

// --- Export APIs ---
export { userApi };
export const buildingApi = createApiService<Building>('Buildings');
export const floorApi = createApiService<Floor>('Floors');
export const roomApi = createApiService<Room>('Rooms');
export const employeeApi = createApiService<Employee>('Employees');
export const assignmentApi = createApiService<Assignment>('Assignments');
export const maintenanceApi = createApiService<MaintenanceRequest>('MaintenanceRequests');
export const reservationApi = createApiService<Reservation>('Reservations');
export const hostingApi = createApiService<Hosting>('Hostings');