import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { userApi, logActivity } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';

const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const { user: currentUser, logout } = useAuth();
    const { t } = useLanguage();
    const { showToast } = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        roles: ['viewer'] as User['roles'],
        status: 'active' as User['status'],
        password: '',
    });

    const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
    const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await userApi.getAll();
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users", error);
            showToast(t('errors.fetchFailed'), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        return users.filter(user =>
            user.username.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    const openAddModal = () => {
        setEditingUser(null);
        setFormData({ username: '', roles: ['viewer'], status: 'active', password: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormData({ ...user, password: '' });
        setIsModalOpen(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleRolesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        const role = name as User['roles'][number];
        setFormData(prev => {
            const newRoles = checked
                ? [...prev.roles, role]
                : prev.roles.filter(r => r !== role);
            
            if (newRoles.length === 0) {
                return { ...prev, roles: ['viewer'] };
            }
            return { ...prev, roles: newRoles };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const isDuplicate = users.some(
            user => user.username.trim().toLowerCase() === formData.username.trim().toLowerCase() && user.id !== editingUser?.id
        );
        if (isDuplicate) {
            showToast(t('errors.duplicateUsername', { username: formData.username }), 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingUser) {
                const updateData: Partial<Omit<User, 'id'>> & { password?: string } = {
                    username: formData.username,
                    roles: formData.roles,
                    status: formData.status
                };
                if (formData.password) {
                    updateData.password = formData.password;
                }
                await userApi.update(editingUser.id, updateData);
                logActivity(currentUser!.username, `Updated user: ${formData.username}`);
                showToast(t('users.updated'), 'success');
            } else {
                if (!formData.password) {
                    showToast(t('users.passwordRequired'), 'error');
                    setIsSubmitting(false);
                    return;
                }
                await userApi.create(formData);
                logActivity(currentUser!.username, `Created user: ${formData.username}`);
                showToast(t('users.added'), 'success');
            }
            setIsModalOpen(false);
            await fetchUsers();
        } catch (error) {
            console.error("Failed to save user", error);
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (userToDelete: User) => {
        if (userToDelete.id === currentUser?.id) {
            showToast(t('users.cannotDeleteSelf'), 'error');
            return;
        }
        if (!window.confirm(t('users.deleteConfirm', { name: userToDelete.username }))) return;
        try {
            await userApi.delete(userToDelete.id);
            logActivity(currentUser!.username, `Deleted user: ${userToDelete.username}`);
            showToast(t('users.deleted'), 'success');
            await fetchUsers();
        } catch (error) {
            console.error("Failed to delete user", error);
            showToast(t('errors.generic'), 'error');
        }
    };
    
    const toggleUserStatus = async (userToToggle: User) => {
        if (userToToggle.id === currentUser?.id) {
            showToast(t('users.cannotChangeSelf'), 'error');
            return;
        }
        const newStatus = userToToggle.status === 'active' ? 'inactive' : 'active';
        try {
            await userApi.update(userToToggle.id, { status: newStatus });
            logActivity(currentUser!.username, `Set user ${userToToggle.username} status to ${newStatus}`);
            showToast(t('users.statusUpdated'), 'success');
            await fetchUsers();
        } catch (error) {
             console.error("Failed to update user status", error);
            showToast(t('errors.generic'), 'error');
        }
    }
    
    const openResetPasswordModal = (user: User) => {
        setUserToResetPassword(user);
        setNewPassword('');
        setIsResetPasswordModalOpen(true);
    };

    const handleResetPassword = async () => {
        if (!userToResetPassword || !newPassword) return;
        setIsSubmitting(true);
        try {
            await userApi.update(userToResetPassword.id, { password: newPassword });
            logActivity(currentUser!.username, `Reset password for user: ${userToResetPassword.username}`);
            showToast(t('users.resetPasswordSuccess'), 'success');
            setIsResetPasswordModalOpen(false);
        } catch (error) {
            showToast(t('errors.generic'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status: User['status']) => {
        return status === 'active'
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    };

    const formInputClass = "w-full p-2 border border-slate-300 rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-200";
    const allRoles: User['roles'][number][] = ['super_admin', 'admin', 'manager', 'supervisor', 'hr', 'maintenance', 'viewer'];

    return (
        <>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">{t('users.title')}</h1>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md">
                    <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                        <input
                            type="text"
                            placeholder={t('users.search')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full sm:w-80 p-2.5 dark:bg-slate-700 dark:border-slate-600"
                        />
                        <button onClick={openAddModal} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm whitespace-nowrap"><i className="fas fa-plus me-2"></i>{t('users.add')}</button>
                    </div>

                    {loading ? (<div className="p-6 text-center">{t('loading')}...</div>) : (
                        <div className="relative overflow-x-auto">
                            <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-100 dark:bg-slate-700 dark:text-slate-400">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">{t('users.username')}</th>
                                        <th scope="col" className="px-6 py-3">{t('users.role')}</th>
                                        <th scope="col" className="px-6 py-3">{t('users.status')}</th>
                                        <th scope="col" className="px-6 py-3">{t('actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(user => (
                                        <tr key={user.id} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                            <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">{user.username}</th>
                                            <td className="px-6 py-4">{user.roles.map(r => t(`roles.${r}`)).join(', ')}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(user.status)}`}>{t(`statuses.${user.status}`)}</span>
                                            </td>
                                            <td className="px-6 py-4 space-x-2 rtl:space-x-reverse whitespace-nowrap">
                                                <button onClick={() => openResetPasswordModal(user)} className="font-medium text-blue-600 dark:text-blue-500 hover:underline disabled:text-slate-400 disabled:cursor-not-allowed" disabled={user.id === currentUser?.id}>{t('users.resetPassword')}</button>
                                                <button onClick={() => toggleUserStatus(user)} className="font-medium text-yellow-600 dark:text-yellow-500 hover:underline disabled:text-slate-400 disabled:cursor-not-allowed" disabled={user.id === currentUser?.id}>
                                                    {t(`users.toggleStatus.${user.status}`)}
                                                </button>
                                                <button onClick={() => openEditModal(user)} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">{t('edit')}</button>
                                                <button onClick={() => handleDelete(user)} className="font-medium text-red-600 dark:text-red-500 hover:underline disabled:text-slate-400 disabled:cursor-not-allowed" disabled={user.id === currentUser?.id}>{t('delete')}</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">{editingUser ? t('users.edit') : t('users.add')}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-4">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('users.username')}</label><input type="text" name="username" value={formData.username} onChange={handleFormChange} required className={formInputClass}/></div>
                                    {editingUser && (<div><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('users.status')}</label><select name="status" value={formData.status} onChange={handleFormChange} className={formInputClass}><option value="active">{t('statuses.active')}</option><option value="inactive">{t('statuses.inactive')}</option></select></div>)}
                                    <div className="md:col-span-2"><label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('users.password')}</label><input type="password" name="password" value={formData.password} placeholder={editingUser ? t('users.passwordPlaceholder') : ''} onChange={handleFormChange} required={!editingUser} className={formInputClass}/></div>
                               </div>
                               <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('users.role')}</label>
                                    <div className="grid grid-cols-3 gap-2 p-2 border rounded-md border-slate-300 dark:border-slate-600">
                                        {allRoles.map((roleKey) => (
                                            <label key={roleKey} htmlFor={`role-${roleKey}`} className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    id={`role-${roleKey}`}
                                                    name={roleKey}
                                                    checked={formData.roles.includes(roleKey)}
                                                    onChange={handleRolesChange}
                                                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                                />
                                                <span className="text-sm text-slate-700 dark:text-slate-300">{t(`roles.${roleKey}`)}</span>
                                            </label>
                                        ))}
                                    </div>
                               </div>
                            </div>
                            <div className="flex justify-end gap-4 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded disabled:bg-primary-400">{isSubmitting ? `${t('saving')}...` : t('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {isResetPasswordModalOpen && userToResetPassword && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                        <h2 className="text-xl font-bold mb-2 text-slate-800 dark:text-white">{t('users.resetPassword')}</h2>
                        <p className="mb-4 text-slate-600 dark:text-slate-400">{t('users.resetPasswordFor', { username: userToResetPassword.username })}</p>
                        <div className="mb-4">
                             <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">{t('users.newPassword')}</label>
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className={formInputClass} />
                        </div>
                        <div className="flex justify-end gap-4 mt-6">
                            <button type="button" onClick={() => setIsResetPasswordModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 rounded">{t('cancel')}</button>
                            <button onClick={handleResetPassword} disabled={isSubmitting || !newPassword} className="px-4 py-2 bg-primary-600 text-white rounded disabled:opacity-50">{isSubmitting ? `${t('saving')}...` : t('save')}</button>
                        </div>
                    </div>
                 </div>
            )}
        </>
    );
};

export default UsersPage;