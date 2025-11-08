import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { Notification } from '../context/ToastContext';
import { User } from '../types';
import ExportSettingsModal from '../components/settings/ExportSettingsModal';

interface LayoutProps {
  theme: string;
  toggleTheme: () => void;
}

const Logo = () => (
  <div className="flex items-center">
    <svg width="36" height="36" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Building shape */}
      <path d="M50 10 L85 40 H15 Z" className="fill-primary-600 dark:fill-primary-500" />
      {/* Avenue/Path shape */}
      <path d="M40 90 L25 40 H75 L60 90 Z" className="fill-amber-400" />
    </svg>
    <span className="self-center text-2xl font-bold sm:text-3xl whitespace-nowrap text-slate-900 dark:text-white ms-2 tracking-wide">
      Tal Avenue
    </span>
  </div>
);


const Layout: React.FC<LayoutProps> = ({ theme, toggleTheme }) => {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { notifications, unreadCount, markAllAsRead, showToast } = useToast();
  const navigate = useNavigate();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const notificationDropdownRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  useEffect(() => {
    const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes
    let inactivityTimer: number;

    const onTimeout = () => {
        showToast(t('errors.inactivityLogout'), 'info');
        handleLogout();
    };

    const resetTimer = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = window.setTimeout(onTimeout, INACTIVITY_TIMEOUT);
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
        clearTimeout(inactivityTimer);
        events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [handleLogout, showToast, t]);
  
  const handleLanguageToggle = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };
  
  const handleBellClick = () => {
    setNotificationDropdownOpen(prev => !prev);
    if (!notificationDropdownOpen) {
        setTimeout(() => markAllAsRead(), 1000);
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target as Node)) {
        setNotificationDropdownOpen(false);
      }
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if(!target.closest('[data-drawer-toggle="logo-sidebar"]')) {
           setSidebarOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const userRoles = user?.roles || [];
  const isSuperAdminOrAdmin = userRoles.some(r => ['super_admin', 'admin'].includes(r));

  const housingAndGeneralRoles: User['roles'][number][] = ['super_admin', 'admin', 'manager', 'supervisor', 'hr', 'viewer'];
  const maintenanceRoles: User['roles'][number][] = ['super_admin', 'admin', 'manager', 'supervisor', 'maintenance', 'viewer'];

  const navLinks = [
    { to: "/", icon: "fa-tachometer-alt", label: t('layout.dashboard'), visible: true },
    { to: "/housing", icon: "fa-building", label: t('layout.housing'), visible: housingAndGeneralRoles.some(r => userRoles.includes(r)) },
    { to: "/employees", icon: "fa-users", label: t('layout.employees'), visible: housingAndGeneralRoles.some(r => userRoles.includes(r)) },
    { to: "/reservations", icon: "fa-calendar-check", label: t('layout.reservations'), visible: housingAndGeneralRoles.some(r => userRoles.includes(r)) },
    { to: "/maintenance", icon: "fa-wrench", label: t('layout.maintenance'), visible: maintenanceRoles.some(r => userRoles.includes(r)) },
    { to: "/users", icon: "fa-user-cog", label: t('layout.userManagement'), visible: isSuperAdminOrAdmin },
    { to: "/activity-log", icon: "fa-history", label: t('layout.activityLog'), visible: isSuperAdminOrAdmin },
  ];
  
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
        case 'success': return 'fa-check-circle text-green-500';
        default: return 'fa-info-circle text-primary-500';
    }
  };


  return (
    <div className={language === 'ar' ? 'font-arabic' : 'font-sans'}>
      <nav className="fixed top-0 z-50 w-full bg-white border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700">
        <div className="px-3 py-3 lg:px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-start">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} data-drawer-toggle="logo-sidebar" aria-controls="logo-sidebar" type="button" className="inline-flex items-center p-2 text-sm text-slate-500 rounded-lg sm:hidden hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:text-slate-400 dark:hover:bg-slate-700 dark:focus:ring-slate-600">
                  <span className="sr-only">Open sidebar</span>
                  <i className="fas fa-bars w-6 h-6"></i>
               </button>
              <Logo />
            </div>
            <div className="flex items-center">
              <button onClick={handleLanguageToggle} className="p-2 text-slate-500 rounded-lg hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700">
                  <i className="fas fa-language text-lg"></i>
              </button>
              <button onClick={toggleTheme} className="p-2 text-slate-500 rounded-lg hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700">
                {theme === 'light' ? <i className="fas fa-moon"></i> : <i className="fas fa-sun"></i>}
              </button>
               <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-slate-500 rounded-lg hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700">
                <i className="fas fa-cog"></i>
              </button>

              <div className="relative mx-3" ref={notificationDropdownRef}>
                  <button onClick={handleBellClick} className="p-2 relative text-slate-500 rounded-lg hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700">
                      <i className="fas fa-bell"></i>
                      {unreadCount > 0 && (
                          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">{unreadCount}</span>
                      )}
                  </button>
                  {notificationDropdownOpen && (
                      <div className={`absolute z-50 my-2 w-72 md:w-96 text-base list-none bg-white divide-y divide-slate-100 rounded shadow-lg dark:bg-slate-700 dark:divide-slate-600 ${language === 'ar' ? 'left-0' : 'right-0'}`}>
                          <div className="px-4 py-3 font-bold text-slate-900 dark:text-white">{t('notifications.title')}</div>
                          <ul className="py-1 max-h-80 overflow-y-auto">
                              {notifications.length > 0 ? notifications.map(notif => (
                                  <li key={notif.id} className={`px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 ${!notif.read ? 'bg-primary-50 dark:bg-primary-900/40' : ''}`}>
                                      <div className="flex items-start">
                                          <i className={`fas ${getNotificationIcon(notif.type)} mt-1`}></i>
                                          <div className="ms-3 w-full">
                                              <p className="text-sm text-slate-700 dark:text-slate-200">{notif.message}</p>
                                              <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(notif.timestamp).toLocaleString()}</p>
                                          </div>
                                      </div>
                                  </li>
                              )) : (
                                <li><p className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">{t('notifications.empty')}</p></li>
                              )}
                          </ul>
                      </div>
                  )}
              </div>

              <div className="relative" ref={userDropdownRef}>
                <div>
                  <button onClick={() => setUserDropdownOpen(!userDropdownOpen)} type="button" className="flex text-sm bg-slate-800 rounded-full focus:ring-4 focus:ring-slate-300 dark:focus:ring-slate-600" aria-expanded="false">
                    <span className="sr-only">Open user menu</span>
                     <img 
                        loading="lazy"
                        className="w-8 h-8 rounded-full" 
                        src={`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%233b82f6" /><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="50" fill="white" font-family="sans-serif">${user?.username.charAt(0).toUpperCase()}</text></svg>`}
                        alt="User avatar" 
                     />
                  </button>
                </div>
                {userDropdownOpen && (
                  <div className={`absolute z-50 my-2 w-48 text-base list-none bg-white divide-y divide-slate-100 rounded shadow dark:bg-slate-700 dark:divide-slate-600 ${language === 'ar' ? 'left-0' : 'right-0'}`}>
                    <div className="px-4 py-3">
                      <span className="block text-sm text-slate-900 dark:text-white">{user?.username}</span>
                      <span className="block text-sm font-medium text-slate-500 truncate dark:text-slate-400">{user?.roles.map(r => t(`roles.${r}`)).join(', ')}</span>
                    </div>
                    <ul className="py-1" aria-labelledby="dropdown">
                      <li>
                        <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 dark:text-slate-200 dark:hover:text-white">{t('layout.profile')}</a>
                      </li>
                      <li>
                        <button onClick={handleLogout} className="block w-full text-start px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 dark:text-slate-200 dark:hover:text-white">
                          {t('layout.signOut')}
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <aside 
        id="logo-sidebar" 
        ref={sidebarRef}
        className={`fixed top-0 z-40 w-72 h-screen pt-20 transition-transform bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 
            ${language === 'ar' ? 'right-0 border-l' : 'left-0 border-r'} 
            ${sidebarOpen ? 'translate-x-0' : (language === 'ar' ? 'translate-x-full' : '-translate-x-full')}
            sm:translate-x-0
        `} 
        aria-label="Sidebar">
        <div className="h-full px-3 pb-4 overflow-y-auto bg-white dark:bg-slate-800">
          <ul className="space-y-1.5 pt-2">
            {navLinks.map(link => link.visible && (
              <li key={link.to}>
                <NavLink 
                  to={link.to} 
                  end={link.to === "/"} 
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `relative flex items-center px-4 py-3 rounded-md group transition-all duration-200 font-medium ${
                      isActive 
                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300 font-semibold' 
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className={`absolute w-1 rounded-full bg-primary-500 dark:bg-primary-400 inset-y-2.5 ${language === 'ar' ? 'right-0' : 'left-0'}`}></span>
                      )}
                      <i className={`fas ${link.icon} w-5 h-5 transition duration-75 ${isActive ? 'text-primary-600 dark:text-primary-300' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-400'}`}></i>
                      <span className="ms-4">{link.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className={`p-4 ${language === 'ar' ? 'sm:mr-72' : 'sm:ml-72'}`}>
        <div className="p-4 mt-14">
          <Outlet />
        </div>
      </div>
      
      <ExportSettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
};

export default Layout;