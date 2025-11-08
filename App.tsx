import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Layout from './pages/Layout';
import DashboardPage from './pages/DashboardPage';
import BuildingsAndRoomsPage from './pages/BuildingsAndRoomsPage';
import EmployeesPage from './pages/EmployeesPage';
import AssignmentsPage from './pages/AssignmentsPage';
import MaintenancePage from './pages/MaintenancePage';
import UsersPage from './pages/UsersPage';
import ActivityLogPage from './pages/ActivityLogPage';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import { initDb } from './services/apiService';
import { ExportSettingsProvider } from './context/ExportSettingsContext';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ToastProvider>
          <ExportSettingsProvider>
            <AppContent />
          </ExportSettingsProvider>
        </ToastProvider>
      </LanguageProvider>
    </AuthProvider>
  );
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    initDb().then(() => {
        setDbLoading(false);
    }).catch(err => {
        console.error("Database initialization failed:", err);
        setDbError("Failed to initialize the database. Please try clearing your browser cache or contact support.");
        setDbLoading(false);
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  if (loading || dbLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (dbError) {
      return (
        <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 p-4">
            <div className="text-center text-red-500">
                <h1 className="text-2xl font-bold mb-4">Application Error</h1>
                <p>{dbError}</p>
            </div>
        </div>
      );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/" element={user ? <Layout theme={theme} toggleTheme={toggleTheme} /> : <Navigate to="/login" />}>
          <Route index element={<DashboardPage />} />
          <Route path="housing" element={<BuildingsAndRoomsPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="reservations" element={<AssignmentsPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          {user?.roles?.some(r => ['admin', 'super_admin'].includes(r)) && <Route path="users" element={<UsersPage />} />}
          {user?.roles?.some(r => ['admin', 'super_admin'].includes(r)) && <Route path="activity-log" element={<ActivityLogPage />} />}
        </Route>
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
      </Routes>
    </HashRouter>
  );
};

export default App;