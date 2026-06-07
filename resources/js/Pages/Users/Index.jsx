import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import SelectInput from '@/Components/SelectInput';
import InputLabel from '@/Components/InputLabel';
import InputError from '@/Components/InputError';

export default function UserIndex({ users }) {
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const { data: form, setData: setForm, post, put, processing, errors, clearErrors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        role: 'lider',
        modules: [],
    });

    const AVAILABLE_MODULES = [
        { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
        { id: 'shifts.index', label: 'Horarios', icon: '🕒' },
        { id: 'reports.preoperational', label: 'Preoperacional', icon: '📋' },
        { id: 'reports.cleaning', label: 'Aseo', icon: '✨' },
        { id: 'reports.global-stats', label: 'Estadísticas Globales', icon: '📊' },
        { id: 'reports.lunch', label: 'Almuerzo', icon: '🍽️' },
        { id: 'reports.exit', label: 'Salida', icon: '🏁' },
        { id: 'external-forms.index', label: 'Formularios', icon: '📝' },
        { id: 'messengers.index', label: 'Mensajeros', icon: '🛵' },
        { id: 'users.index', label: 'Usuarios', icon: '👤' },
        { id: 'procedures.index', label: 'Trámites', icon: '💼' },
    ];

    const openModal = (user = null) => {
        clearErrors();
        if (user) {
            setEditingUser(user);
            setForm('name', user.name);
            setForm('email', user.email);
            setForm('password', '');
            setForm('role', user.role);
            setForm('modules', user.modules || []);
        } else {
            setEditingUser(null);
            reset();
        }
        setShowModal(true);
    };

    const handleModuleToggle = (moduleId) => {
        const currentModules = [...form.modules];
        if (currentModules.includes(moduleId)) {
            setForm('modules', currentModules.filter(id => id !== moduleId));
        } else {
            setForm('modules', [...currentModules, moduleId]);
        }
    };

    const submit = (e) => {
        e.preventDefault();
        if (editingUser) {
            put(route('users.update', editingUser.id), {
                onSuccess: () => setShowModal(false),
            });
        } else {
            post(route('users.store'), {
                onSuccess: () => setShowModal(false),
            });
        }
    };

    const deleteUser = (user) => {
        if (confirm(`¿Estás seguro de eliminar a ${user.name}?`)) {
            router.delete(route('users.destroy', user.id));
        }
    };

    return (
        <LeaderLayout title="Gestión de Usuarios">
            <Head title="Gestión de Usuarios" />

            <div className="max-w-[1800px] mx-auto p-3 sm:p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Gestión de Usuarios</h1>
                    <button
                        onClick={() => openModal()}
                        className="w-full lg:w-auto px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95 flex items-center justify-center gap-2"
                    >
                        <span>➕</span> Nuevo Usuario
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Nombre
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Rol
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Módulos
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                            {user.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                            {user.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className="px-2 inline-flex text-[10px] leading-5 font-black uppercase tracking-widest rounded-full border bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                {user.modules && user.modules.length > 0 ? (
                                                    user.modules.map(modId => {
                                                        const mod = AVAILABLE_MODULES.find(m => m.id === modId);
                                                        return mod ? (
                                                            <span key={modId} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[9px] font-bold uppercase tracking-tighter" title={mod.label}>
                                                                {mod.icon}
                                                            </span>
                                                        ) : null;
                                                    })
                                                ) : (
                                                    <span className="text-gray-400 italic text-[10px]">Por defecto</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    onClick={() => openModal(user)}
                                                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 font-bold uppercase text-[10px] tracking-widest transition-colors"
                                                    title="Editar Usuario"
                                                >
                                                    EDITAR
                                                </button>
                                                <button
                                                    onClick={() => deleteUser(user)}
                                                    className="text-red-600 dark:text-red-400 hover:text-red-900 font-bold uppercase text-[10px] tracking-widest transition-colors"
                                                    title="Eliminar Usuario"
                                                >
                                                    ELIMINAR
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <Modal show={showModal} onClose={() => setShowModal(false)} maxWidth="2xl">
                <div className="p-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6 uppercase tracking-tight">
                        {editingUser ? 'Actualizar Usuario' : 'Crear Nuevo Usuario'}
                    </h2>

                    <form onSubmit={submit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <InputLabel htmlFor="name" value="Nombre" />
                                <TextInput
                                    id="name"
                                    className="mt-1 block w-full"
                                    value={form.name}
                                    onChange={(e) => setForm('name', e.target.value)}
                                    required
                                />
                                <InputError message={errors.name} className="mt-2" />
                            </div>

                            <div>
                                <InputLabel htmlFor="email" value="Email" />
                                <TextInput
                                    id="email"
                                    type="email"
                                    className="mt-1 block w-full"
                                    value={form.email}
                                    onChange={(e) => setForm('email', e.target.value)}
                                    required
                                />
                                <InputError message={errors.email} className="mt-2" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <InputLabel htmlFor="password" value={editingUser ? 'Contraseña (Opcional)' : 'Contraseña'} />
                                <TextInput
                                    id="password"
                                    type="password"
                                    className="mt-1 block w-full"
                                    value={form.password}
                                    onChange={(e) => setForm('password', e.target.value)}
                                    required={!editingUser}
                                />
                                <InputError message={errors.password} className="mt-2" />
                            </div>

                            <div>
                                <InputLabel htmlFor="role" value="Rol Base" />
                                <SelectInput
                                    id="role"
                                    className="mt-1 block w-full"
                                    value={form.role}
                                    onChange={(e) => setForm('role', e.target.value)}
                                    required
                                >
                                    <option value="administrador">Administrador</option>
                                    <option value="desarrollador">Desarrollador</option>
                                    <option value="lider">Líder</option>
                                    <option value="regente">Regente</option>
                                </SelectInput>
                                <InputError message={errors.role} className="mt-2" />
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
                            <InputLabel value="Habilitar Accesos Manuales" className="mb-4" />
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {AVAILABLE_MODULES.map((mod) => (
                                    <button
                                        key={mod.id}
                                        type="button"
                                        onClick={() => handleModuleToggle(mod.id)}
                                        className={`
                                            relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all group
                                            ${form.modules.includes(mod.id)
                                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                                : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-400'}
                                        `}
                                    >
                                        <span className={`text-xl mb-1 transition-transform ${form.modules.includes(mod.id) ? 'scale-110' : 'group-hover:scale-110'}`}>
                                            {mod.icon}
                                        </span>
                                        <span className="text-[9px] font-black uppercase tracking-tight text-center leading-none">
                                            {mod.label}
                                        </span>
                                        {form.modules.includes(mod.id) && (
                                            <div className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full" />
                                        )}
                                    </button>
                                ))}
                            </div>
                            <p className="mt-3 text-[10px] text-slate-400 italic">
                                * Nota: Si selecciona módulos aquí, estos serán los únicos accesibles para el usuario, ignorando los permisos por defecto de su rol.
                            </p>
                        </div>

                        <div className="flex items-center justify-end mt-6 gap-3">
                            <SecondaryButton onClick={() => setShowModal(false)}>
                                Cancelar
                            </SecondaryButton>
                            <PrimaryButton disabled={processing}>
                                {editingUser ? 'Actualizar' : 'Crear'}
                            </PrimaryButton>
                        </div>
                    </form>
                </div>
            </Modal>
        </LeaderLayout>
    );
}
