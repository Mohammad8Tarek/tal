import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { Notification } from '../context/ToastContext';
import { User } from '../types';
import ExportSettingsModal from '../components/settings/ExportSettingsModal';
import { userApi, logActivity } from '../services/apiService';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { showToast } = useToast();
    
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
            setError('');
            setIsSubmitting(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            setError(t('login.fillFields'));
            return;
        }
        if (newPassword.length < 6) {
            setError(t('errors.passwordTooShort'));
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setError(t('errors.passwordMismatch'));
            return;
        }
        
        setIsSubmitting(true);
        try {
            if (!user) throw new Error("User not found");
            await userApi.changePassword({
                userId: user.id,
                currentPassword,
                newPassword,
            });
            logActivity(user.username, 'Changed password');
            showToast(t('changePassword.success'), 'success');
            onClose();
        } catch (err: any) {
            setError(t('errors.incorrectPassword'));
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const formInputClass = "w-full p-2 border border-slate-300 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-200";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('changePassword.title')}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('changePassword.currentPassword')}</label>
                        <input 
                            type="password" 
                            value={currentPassword} 
                            onChange={e => setCurrentPassword(e.target.value)} 
                            required 
                            className={formInputClass}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('changePassword.newPassword')}</label>
                        <input 
                            type="password" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
                            required 
                            className={formInputClass}
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('changePassword.confirmNewPassword')}</label>
                        <input 
                            type="password" 
                            value={confirmNewPassword} 
                            onChange={e => setConfirmNewPassword(e.target.value)} 
                            required 
                            className={formInputClass}
                        />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">
                            {isSubmitting ? `${t('saving')}...` : t('save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


interface LayoutProps {
  theme: string;
  toggleTheme: () => void;
}

const Logo = () => (
  <div className="flex items-center">
    <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Building shape */}
      <path d="M50 10 L85 40 H15 Z" className="fill-primary-600 dark:fill-primary-500" />
      {/* Avenue/Path shape */}
      <path d="M40 90 L25 40 H75 L60 90 Z" className="fill-amber-400" />
    </svg>
    <span className="self-center text-2xl font-semibold whitespace-nowrap text-slate-900 dark:text-white ms-3 tracking-wide">
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
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

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
      <nav className="fixed top-0 z-50 w-full bg-white border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700 h-20">
        <div className="px-6 h-full">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center justify-start">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} data-drawer-toggle="logo-sidebar" aria-controls="logo-sidebar" type="button" className="inline-flex items-center p-2 text-sm text-slate-500 rounded-lg sm:hidden hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:text-slate-400 dark:hover:bg-slate-700 dark:focus:ring-slate-600">
                  <span className="sr-only">Open sidebar</span>
                  <i className="fas fa-bars w-6 h-6"></i>
               </button>
              <Logo />
            </div>
            <div className="flex items-center space-x-5 rtl:space-x-reverse">
              <button onClick={handleLanguageToggle} className="p-2 text-slate-500 rounded-lg hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700">
                  <i className="fas fa-language text-xl"></i>
              </button>
              <button onClick={toggleTheme} className="p-2 text-slate-500 rounded-lg hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700">
                {theme === 'light' ? <i className="fas fa-moon text-xl"></i> : <i className="fas fa-sun text-xl"></i>}
              </button>
               <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-slate-500 rounded-lg hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700">
                <i className="fas fa-cog text-xl"></i>
              </button>

              <div className="relative" ref={notificationDropdownRef}>
                  <button onClick={handleBellClick} className="p-2 relative text-slate-500 rounded-lg hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700">
                      <i className="fas fa-bell text-xl"></i>
                      {unreadCount > 0 && (
                          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">{unreadCount}</span>
                      )}
                  </button>
                  {notificationDropdownOpen && (
                      <div className={`absolute z-50 my-4 w-72 md:w-96 text-base list-none bg-white divide-y divide-slate-100 rounded shadow-lg dark:bg-slate-700 dark:divide-slate-600 ${language === 'ar' ? 'left-0' : 'right-0'}`}>
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
                  <button onClick={() => setUserDropdownOpen(!userDropdownOpen)} type="button" className="flex items-center justify-center text-sm bg-primary-500 rounded-full w-10 h-10 text-white focus:ring-4 focus:ring-slate-300 dark:focus:ring-slate-600" aria-expanded="false">
                    <span className="sr-only">Open user menu</span>
                     <img 
                        loading="lazy"
                        className="w-10 h-10 rounded-full" 
                        src={`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%233b82f6" /><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="50" fill="white" font-family="sans-serif">${user?.username.charAt(0).toUpperCase()}</text></svg>`}
                        alt="User avatar" 
                     />
                  </button>
                </div>
                {userDropdownOpen && (
                  <div className={`absolute z-50 my-4 w-48 text-base list-none bg-white divide-y divide-slate-100 rounded shadow dark:bg-slate-700 dark:divide-slate-600 ${language === 'ar' ? 'left-0' : 'right-0'}`}>
                    <div className="px-4 py-3">
                      <span className="block text-sm text-slate-900 dark:text-white">{user?.username}</span>
                      <span className="block text-sm font-medium text-slate-500 truncate dark:text-slate-400">{user?.roles.map(r => t(`roles.${r}`)).join(', ')}</span>
                    </div>
                    <ul className="py-1" aria-labelledby="dropdown">
                      <li>
                        <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 dark:text-slate-200 dark:hover:text-white">{t('layout.profile')}</a>
                      </li>
                      <li>
                        <button onClick={() => setIsChangePasswordModalOpen(true)} className="block w-full text-start px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 dark:text-slate-200 dark:hover:text-white">
                            {t('layout.changePassword')}
                        </button>
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
        className={`fixed top-0 z-40 w-72 h-screen pt-20 transition-transform bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 
            ${language === 'ar' ? 'right-0 border-l' : 'left-0 border-r'} 
            ${sidebarOpen ? 'translate-x-0' : (language === 'ar' ? 'translate-x-full' : '-translate-x-full')}
            sm:translate-x-0
        `} 
        aria-label="Sidebar">
        <div className="h-full px-3 pb-4 overflow-y-auto bg-slate-50 dark:bg-slate-800">
          <ul className="space-y-1.5 pt-2">
            {navLinks.map(link => link.visible && (
              <li key={link.to}>
                <NavLink 
                  to={link.to} 
                  end={link.to === "/"} 
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 rounded-md group transition-all duration-200 font-medium ${
                      isActive 
                        ? 'bg-primary-100 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300 font-semibold' 
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`
                  }
                >
                  <i className={`fas ${link.icon} w-5 h-5 transition duration-75 ${'text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-400'}`}></i>
                  <span className="ms-4">{link.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className={`p-4 ${language === 'ar' ? 'sm:mr-72' : 'sm:ml-72'}`}>
        <div className="p-4 mt-20">
          <Outlet />
        </div>
      </div>
      
      <ExportSettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
      <ChangePasswordModal 
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />
    </div>
  );
};

export default Layout;