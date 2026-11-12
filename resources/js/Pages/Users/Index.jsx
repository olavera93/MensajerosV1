import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import InputError from '@/Components/InputError';

export default function UserIndex({ users, catalog = [], grantable = [], canCreate = false }) {
    const { flash } = usePage().props;
    const [search, setSearch] = useState('');
    const [editor, setEditor] = useState(null); // null | { user } (user null = nuevo)

    const term = search.trim().toLowerCase();
    const visible = users.filter(u => !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));

    const deleteUser = (user) => {
        if (confirm(`¿Eliminar a ${user.name}? Esta acción no se puede deshacer.`)) {
            router.delete(route('users.destroy', user.id), { preserveScroll: true });
        }
    };

    return (
        <LeaderLayout title="Usuarios">
            <Head title="Usuarios" />

            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Encabezado */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Usuarios</h1>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            {users.length} {users.length === 1 ? 'usuario' : 'usuarios'} · quién entra a la plataforma y qué puede hacer en cada módulo
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nombre o correo"
                                aria-label="Buscar usuarios"
                                className="h-10 w-full sm:w-72 pl-9 pr-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                        {canCreate && (
                            <button
                                type="button"
                                onClick={() => setEditor({ user: null })}
                                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm inline-flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
                                Nuevo usuario
                            </button>
                        )}
                    </div>
                </div>

                {flash?.error && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-sm font-semibold text-rose-800 dark:text-rose-300">{flash.error}</div>
                )}
                {flash?.success && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm font-semibold text-emerald-800 dark:text-emerald-300">{flash.success}</div>
                )}

                {/* Tarjetas de usuario */}
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                    {visible.map(user => (
                        <UserCard key={user.id} user={user} catalog={catalog} onEdit={() => setEditor({ user })} onDelete={() => deleteUser(user)} />
                    ))}
                </div>
                {visible.length === 0 && (
                    <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">Ningún usuario coincide con “{search}”.</p>
                )}
            </div>

            {editor && (
                <UserEditor
                    user={editor.user}
                    users={users}
                    catalog={catalog}
                    grantable={grantable}
                    onClose={() => setEditor(null)}
                />
            )}
        </LeaderLayout>
    );
}

function Avatar({ name, developer }) {
    const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    return (
        <span className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-black ${developer ? 'bg-violet-600' : 'bg-indigo-600'}`}>
            {initials}
        </span>
    );
}

function UserCard({ user, catalog, onEdit, onDelete }) {
    const modules = catalog
        .filter(g => user.is_developer || user.permissions.includes(`${g.key}.ver`))
        .map(g => {
            const granted = user.is_developer ? g.actions.length : g.actions.filter(a => user.permissions.includes(a.key)).length;
            return { ...g, granted, full: granted === g.actions.length };
        });

    return (
        <article className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <div className="flex items-center gap-3 p-4 pb-3">
                <Avatar name={user.name} developer={user.is_developer} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white truncate">{user.name}</h2>
                        {user.is_self && <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">Tú</span>}
                        {user.is_developer && <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300">Desarrollador</span>}
                    </div>
                    <p className="text-[13px] text-slate-600 dark:text-slate-400 truncate">{user.email}</p>
                </div>
            </div>

            <div className="flex-1 px-4 pb-4">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                    {user.is_developer ? 'Acceso total' : modules.length === 0 ? 'Sin accesos' : `${modules.length} ${modules.length === 1 ? 'módulo' : 'módulos'}`}
                </p>
                {!user.is_developer && modules.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                        {modules.map(g => (
                            <li
                                key={g.key}
                                title={`${g.label}: ${g.actions.filter(a => user.permissions.includes(a.key)).map(a => a.label).join(', ')}`}
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${g.full
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
                            >
                                <span aria-hidden="true">{g.icon}</span>
                                {g.label}
                                {!g.full && <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{g.granted}/{g.actions.length}</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                {!user.manageable && (
                    <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" title="Solo administras usuarios cuyos permisos también tienes">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
                        Sin permiso para editar
                    </span>
                )}
                {user.deletable && (
                    <button type="button" onClick={onDelete} className="h-9 px-3 rounded-lg text-sm font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20">
                        Eliminar
                    </button>
                )}
                {user.manageable && (
                    <button type="button" onClick={onEdit} className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700">
                        {user.is_self ? 'Editar mis datos' : 'Editar'}
                    </button>
                )}
            </div>
        </article>
    );
}

// Panel lateral: datos de la cuenta arriba, permisos por módulo abajo, acciones fijas al pie
function UserEditor({ user, users, catalog, grantable, onClose }) {
    const isNew = !user;
    const locked = !!user && (user.is_self || user.is_developer);
    const firstInput = useRef(null);

    const { data, setData, post, put, processing, errors } = useForm({
        name: user?.name ?? '',
        email: user?.email ?? '',
        password: '',
        permissions: user?.permissions ?? [],
    });

    useEffect(() => {
        firstInput.current?.focus();
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
    }, []);

    // Solo módulos y acciones que quien edita puede otorgar
    const groups = useMemo(() => catalog
        .map(g => ({ ...g, actions: g.actions.filter(a => grantable.includes(a.key)) }))
        .filter(g => g.actions.length > 0), [catalog, grantable]);
    const allKeys = groups.flatMap(g => g.actions.map(a => a.key));

    const has = (key) => data.permissions.includes(key);
    const setPerms = (list) => setData('permissions', [...new Set(list)]);

    // Acciones que necesitan otra (p. ej. Crear ruta en DispatchTrack necesita Asignar ruta)
    const requires = Object.fromEntries(catalog.flatMap(g => g.actions.map(a => [a.key, a.requires || []])));
    const dependentsOf = (key) => Object.keys(requires).filter(k => requires[k].includes(key));

    const toggleAction = (g, key) => {
        const view = `${g.key}.ver`;
        if (has(key)) {
            // Quitar "Ver" quita todo el módulo; quitar una acción quita también las que dependen de ella
            const removed = key === view ? data.permissions.filter(p => p.startsWith(`${g.key}.`)) : [key, ...dependentsOf(key)];
            setPerms(data.permissions.filter(p => !removed.includes(p)));
        } else {
            // Cualquier acción incluye "Ver" y lo que necesita para funcionar
            setPerms([...data.permissions, key, view, ...(requires[key] || [])]);
        }
    };
    const toggleModule = (g) => {
        const keys = g.actions.map(a => a.key);
        setPerms(has(`${g.key}.ver`) ? data.permissions.filter(p => !keys.includes(p)) : [...data.permissions, ...keys]);
    };
    const copyFrom = (id) => {
        const source = users.find(u => String(u.id) === id);
        if (source) setPerms(source.permissions.filter(p => grantable.includes(p)));
    };

    const submit = (e) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        isNew ? post(route('users.store'), options) : put(route('users.update', user.id), options);
    };

    const permissionError = errors.permissions || Object.entries(errors).find(([k]) => k.startsWith('permissions.'))?.[1];
    const grantedCount = data.permissions.filter(p => allKeys.includes(p)).length;

    return createPortal(
        <div className="fixed inset-0 z-[3000] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="user-editor-title">
            <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />

            <form onSubmit={submit} className="relative w-full max-w-2xl h-full flex flex-col bg-slate-50 dark:bg-slate-900 shadow-2xl">
                {/* Encabezado */}
                <div className="flex items-center gap-3 px-5 sm:px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex-1 min-w-0">
                        <h2 id="user-editor-title" className="text-lg font-black text-slate-900 dark:text-white truncate">
                            {isNew ? 'Nuevo usuario' : user.is_self ? 'Mis datos' : user.name}
                        </h2>
                        <p className="text-[13px] text-slate-600 dark:text-slate-400">
                            {isNew ? 'Crea la cuenta y elige qué puede hacer.' : 'Datos de la cuenta y permisos.'}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar" className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
                    {/* Cuenta */}
                    <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Cuenta</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Nombre" error={errors.name}>
                                <input ref={firstInput} value={data.name} onChange={(e) => setData('name', e.target.value)} required className={inputClass} />
                            </Field>
                            <Field label="Correo" error={errors.email}>
                                <input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} required className={inputClass} />
                            </Field>
                            <div className="sm:col-span-2">
                                <Field label="Contraseña" hint={isNew ? 'Mínimo 8 caracteres.' : 'Déjala vacía para conservar la actual.'} error={errors.password}>
                                    <input type="password" value={data.password} onChange={(e) => setData('password', e.target.value)} required={isNew} autoComplete="new-password" className={inputClass} />
                                </Field>
                            </div>
                        </div>
                    </section>

                    {/* Permisos */}
                    <section>
                        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Permisos</h3>
                                {!locked && <p className="text-[13px] text-slate-600 dark:text-slate-400">{grantedCount} de {allKeys.length} activos · cualquier acción incluye “Ver”</p>}
                            </div>
                            {!locked && (
                                <div className="flex items-center gap-2">
                                    <select value="" onChange={(e) => copyFrom(e.target.value)} aria-label="Copiar permisos de otro usuario"
                                        className="h-9 pl-3 pr-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[13px] text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:ring-indigo-500">
                                        <option value="">Copiar de…</option>
                                        {users.filter(u => u.id !== user?.id && !u.is_developer).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                    <button type="button" onClick={() => setPerms(allKeys)} className={ghostButton}>Todos</button>
                                    <button type="button" onClick={() => setPerms([])} className={ghostButton}>Ninguno</button>
                                </div>
                            )}
                        </div>

                        {locked ? (
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm text-slate-700 dark:text-slate-300">
                                {user.is_developer ? 'El desarrollador siempre tiene todos los permisos.' : 'Tus propios permisos solo los puede cambiar otra persona con acceso a Usuarios.'}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-2.5">
                                {groups.map(g => {
                                    const on = has(`${g.key}.ver`);
                                    return (
                                        <div key={g.key} className={`rounded-2xl border bg-white dark:bg-slate-800 transition-colors ${on ? 'border-indigo-300 dark:border-indigo-700' : 'border-slate-200 dark:border-slate-700'}`}>
                                            <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                                                <span className="text-xl leading-none" aria-hidden="true">{g.icon}</span>
                                                <span className={`flex-1 text-sm font-bold ${on ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{g.label}</span>
                                                <input type="checkbox" role="switch" className="sr-only peer" checked={on} onChange={() => toggleModule(g)} aria-label={`Acceso a ${g.label}`} />
                                                <span aria-hidden="true" className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 ${on ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                </span>
                                            </label>
                                            <div className={`flex flex-wrap gap-2 px-4 pb-3 ${on ? '' : 'opacity-60'}`}>
                                                {g.actions.map(a => {
                                                    const active = has(a.key);
                                                    return (
                                                        <button
                                                            key={a.key}
                                                            type="button"
                                                            onClick={() => toggleAction(g, a.key)}
                                                            aria-pressed={active}
                                                            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-semibold transition-colors ${active
                                                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                                                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-indigo-400'}`}
                                                        >
                                                            <span aria-hidden="true" className={`w-3.5 h-3.5 rounded flex items-center justify-center ${active ? 'bg-white/25' : 'border border-slate-400 dark:border-slate-500'}`}>
                                                                {active && <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                            </span>
                                                            {a.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <InputError message={permissionError} className="mt-2" />
                    </section>
                </div>

                {/* Pie fijo */}
                <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-3.5 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
                    <button type="submit" disabled={processing} className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold shadow-sm">
                        {processing ? 'Guardando…' : isNew ? 'Crear usuario' : 'Guardar cambios'}
                    </button>
                </div>
            </form>
        </div>,
        document.body
    );
}

const inputClass = 'mt-1 block w-full h-10 px-3 rounded-lg border shadow-sm border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500';
const ghostButton = 'h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700';

function Field({ label, hint, error, children }) {
    return (
        <label className="block">
            <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">{label}</span>
            {children}
            {hint && !error && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
            <InputError message={error} className="mt-1" />
        </label>
    );
}
