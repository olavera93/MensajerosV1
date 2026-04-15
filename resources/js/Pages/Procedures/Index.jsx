import React, { useState, useEffect, useRef } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import InputLabel from '@/Components/InputLabel';
import InputError from '@/Components/InputError';
import SelectInput from '@/Components/SelectInput';

export default function ProcedureIndex({ procedures, messengers, filters, stats }) {
    const { flash } = usePage().props;
    const [showModal, setShowModal] = useState(false);
    const [editingProcedure, setEditingProcedure] = useState(null);
    const [viewMode, setViewMode] = useState(false);
    const [errors, setErrors] = useState({});

    // Import state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const importFileRef = useRef(null);

    // Multi-selection state
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkStatus, setBulkStatus] = useState('');
    const [bulkMessenger, setBulkMessenger] = useState([]); // This was state variable name in my thought but let's keep it consistent
    const [pendingActions, setPendingActions] = useState({ status: '', messenger_id: '' });

    // Filter state
    const [search, setSearch] = useState(filters.search || '');
    const [statusFilter, setStatusFilter] = useState(filters.status || '');
    const [dateFilter, setDateFilter] = useState(filters.date || '');
    const [perPage, setPerPage] = useState(filters.per_page || 30);

    const [form, setForm] = useState({
        guide: '',
        product: '',
        quantity: '1',
        client_id: '',
        contact_name: '',
        phone: '',
        email: '',
        address: '',
        start_date_day: '',
        start_date_time: '',
        end_date_day: '',
        end_date_time: '',
        priority: 'Normal',
        info: '',
        management_notes: '',
        messenger_id: '',
        status: 'pendiente',
    });

    const splitDateTime = (dateTime) => {
        if (!dateTime) return { day: '', time: '' };
        const parts = dateTime.replace('T', ' ').split(' ');
        return {
            day: parts[0] || '',
            time: parts[1] ? parts[1].substring(0, 5) : ''
        };
    };

    const openModal = (procedure = null, readOnly = false) => {
        setErrors({});
        setViewMode(readOnly);
        if (procedure) {
            const start = splitDateTime(procedure.start_date);
            const end = splitDateTime(procedure.end_date);
            setEditingProcedure(procedure);
            setForm({
                guide: procedure.guide || '',
                product: procedure.product || '',
                quantity: procedure.quantity || '1',
                client_id: procedure.client_id || '',
                contact_name: procedure.contact_name || '',
                phone: procedure.phone || '',
                email: procedure.email || '',
                address: procedure.address || '',
                start_date_day: start.day,
                start_date_time: start.time,
                end_date_day: end.day,
                end_date_time: end.time,
                priority: procedure.priority || 'Normal',
                info: procedure.info || '',
                management_notes: procedure.management_notes || '',
                messenger_id: procedure.messenger_id || '',
                status: procedure.status || 'pendiente',
            });
        } else {
            setEditingProcedure(null);
            setForm({
                guide: '',
                product: '',
                quantity: '1',
                client_id: '',
                contact_name: '',
                phone: '',
                email: '',
                address: '',
                start_date_day: new Date().toISOString().slice(0, 10),
                start_date_time: new Date().toTimeString().slice(0, 5),
                end_date_day: new Date().toISOString().slice(0, 10),
                end_date_time: new Date().toTimeString().slice(0, 5),
                priority: 'Normal',
                info: '',
                management_notes: '',
                messenger_id: '',
                status: 'pendiente',
            });
        }
        setShowModal(true);
    };

    const submit = (e) => {
        e.preventDefault();

        const data = {
            ...form,
            start_date: form.start_date_day && form.start_date_time
                ? `${form.start_date_day} ${form.start_date_time}`
                : form.start_date_day,
            end_date: form.end_date_day && form.end_date_time
                ? `${form.end_date_day} ${form.end_date_time}`
                : form.end_date_day,
        };

        if (editingProcedure) {
            router.put(route('procedures.update', editingProcedure.id), data, {
                onSuccess: () => setShowModal(false),
                onError: (err) => setErrors(err),
            });
        } else {
            router.post(route('procedures.store'), data, {
                onSuccess: () => setShowModal(false),
                onError: (err) => setErrors(err),
            });
        }
    };

    const handleDelete = (id) => {
        if (confirm('¿Estás seguro de eliminar este trámite?')) {
            router.delete(route('procedures.destroy', id), {
                onFinish: () => setSelectedIds(selectedIds.filter(selectedId => selectedId !== id))
            });
        }
    };

    const handleFilterChange = () => {
        router.get(route('procedures.index'), {
            search,
            status: statusFilter,
            date: dateFilter,
            per_page: perPage
        }, {
            preserveState: true,
            replace: true
        });
    };

    // Trigger filter change on input debouncing might be better but let's do direct for now
    useEffect(() => {
        const timer = setTimeout(() => {
            handleFilterChange();
        }, 300);
        return () => clearTimeout(timer);
    }, [search, statusFilter, dateFilter, perPage]);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(procedures.data.map(p => p.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleBulkAction = () => {
        if (selectedIds.length === 0) return;
        if (!pendingActions.status && !pendingActions.messenger_id) {
            alert('Selecciona al menos una acción (Estado o Mensajero)');
            return;
        }

        router.post(route('procedures.bulk-update'), {
            ids: selectedIds,
            status: pendingActions.status || null,
            messenger_id: pendingActions.messenger_id || null
        }, {
            onSuccess: () => {
                setPendingActions({ status: '', messenger_id: '' });
            }
        });
    };

    const handleBulkExport = () => {
        if (selectedIds.length === 0) return;
        const url = new URL(route('procedures.export'));
        selectedIds.forEach(id => url.searchParams.append('ids[]', id));
        window.location.href = url.toString();
    };

    const handleImport = (e) => {
        e.preventDefault();
        if (!importFile) return;
        setImporting(true);
        router.post(route('procedures.import'), { file: importFile }, {
            forceFormData: true,
            onSuccess: () => {
                setShowImportModal(false);
                setImportFile(null);
                if (importFileRef.current) importFileRef.current.value = '';
            },
            onFinish: () => setImporting(false),
        });
    };

    return (
        <LeaderLayout title="Gestión de Trámites">
            <Head title="Trámites" />

            <div className="max-w-[1800px] mx-auto p-4 sm:p-6 lg:p-8">
                {/* Header & Bulk Actions */}
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                            Gestión de Trámites
                            <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold">{stats.total} Total</span>
                        </h1>
                        <div className="flex gap-2">
                            <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div className="px-3 py-1 border-r border-slate-100 dark:border-slate-700">
                                    <div className="text-[9px] uppercase font-bold text-slate-400 leading-none mb-1">Pendiente</div>
                                    <div className="text-xs font-black text-amber-600 leading-none">{stats.pendiente}</div>
                                </div>
                                <div className="px-3 py-1 border-r border-slate-100 dark:border-slate-700">
                                    <div className="text-[9px] uppercase font-bold text-slate-400 leading-none mb-1">En Ruta</div>
                                    <div className="text-xs font-black text-blue-600 leading-none">{stats.en_ruta}</div>
                                </div>
                                <div className="px-3 py-1">
                                    <div className="text-[9px] uppercase font-bold text-slate-400 leading-none mb-1">OK</div>
                                    <div className="text-xs font-black text-emerald-600 leading-none">{stats.completado}</div>
                                </div>
                            </div>
                            <button onClick={() => setShowImportModal(true)} className="px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm">
                                📥 Importar
                            </button>
                            <button onClick={() => openModal()} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 dark:shadow-none">
                                ➕ Nuevo Registro
                            </button>
                        </div>
                    </div>

                    {/* Filters Toolbar */}
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-3">
                            <InputLabel value="Buscar" className="text-[10px] uppercase font-bold text-slate-400 mb-1" />
                            <TextInput
                                placeholder="Guía, nombre, producto..."
                                className="w-full text-xs py-2"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <InputLabel value="Estado" className="text-[10px] uppercase font-bold text-slate-400 mb-1" />
                            <SelectInput
                                className="w-full text-xs py-2"
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                            >
                                <option value="">Todos los estados</option>
                                <option value="pendiente">Pendiente</option>
                                <option value="en_ruta">En Ruta</option>
                                <option value="completado">Completado</option>
                                <option value="cancelado">Cancelado</option>
                            </SelectInput>
                        </div>
                        <div className="md:col-span-3">
                            <InputLabel value="Fecha Programación" className="text-[10px] uppercase font-bold text-slate-400 mb-1" />
                            <TextInput
                                type="date"
                                className="w-full text-xs py-2"
                                value={dateFilter}
                                onChange={e => setDateFilter(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <InputLabel value="Mostrar" className="text-[10px] uppercase font-bold text-slate-400 mb-1" />
                            <SelectInput
                                className="w-full text-xs py-2 bg-slate-50 border-slate-200 rounded-xl"
                                value={perPage}
                                onChange={e => setPerPage(e.target.value)}
                            >
                                <option value="10">10 por pág.</option>
                                <option value="30">30 por pág.</option>
                                <option value="50">50 por pág.</option>
                                <option value="100">100 por pág.</option>
                            </SelectInput>
                        </div>
                        <div className="md:col-span-2">
                            <button
                                onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter(''); setPerPage(30); }}
                                className="w-full py-2 px-3 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors"
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>

                    {/* Multi-select Actions Bar (Floats or sticky) */}
                    {selectedIds.length > 0 && (
                        <div className="bg-indigo-600 dark:bg-indigo-900/90 text-white px-6 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl border-2 border-white/10 backdrop-blur-md animate-fade-in-up">
                            <div className="flex items-center gap-3">
                                <span className="bg-white text-indigo-600 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black">
                                    {selectedIds.length}
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">Trámites</span>
                                    <span className="text-[8px] font-medium opacity-70">Seleccionados para acción masiva</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-2 bg-indigo-700/50 p-1.5 rounded-xl border border-white/5">
                                    <SelectInput
                                        className="text-[10px] py-1 bg-transparent border-none text-white focus:ring-0 min-w-[140px]"
                                        value={pendingActions.messenger_id}
                                        onChange={e => setPendingActions({ ...pendingActions, messenger_id: e.target.value })}
                                    >
                                        <option value="" className="text-slate-800">Assignar Mensajero...</option>
                                        {messengers.map(m => (
                                            <option key={m.id} value={m.id} className="text-slate-800">{m.name}</option>
                                        ))}
                                    </SelectInput>

                                    <div className="w-[1px] h-4 bg-white/20"></div>

                                    <SelectInput
                                        className="text-[10px] py-1 bg-transparent border-none text-white focus:ring-0 min-w-[120px]"
                                        value={pendingActions.status}
                                        onChange={e => setPendingActions({ ...pendingActions, status: e.target.value })}
                                    >
                                        <option value="" className="text-slate-800">Cambiar Estado...</option>
                                        <option value="pendiente" className="text-slate-800">Pendiente</option>
                                        <option value="en_ruta" className="text-slate-800">En Ruta</option>
                                        <option value="completado" className="text-slate-800">Completado</option>
                                    </SelectInput>
                                </div>

                                <button
                                    onClick={handleBulkAction}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
                                >
                                    ⚡ Aplicar Cambios
                                </button>

                                <div className="w-[1px] h-6 bg-white/10 mx-1"></div>

                                <button
                                    onClick={handleBulkExport}
                                    className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-colors"
                                    title="Exportar selección a Excel"
                                >
                                    📤 Exportar
                                </button>

                                <button
                                    onClick={() => { setSelectedIds([]); setPendingActions({ status: '', messenger_id: '' }); }}
                                    className="p-2 hover:bg-rose-500/20 rounded-xl transition-colors group"
                                    title="Cancelar selección"
                                >
                                    <svg className="w-4 h-4 text-white/60 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {flash.success && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 text-emerald-700 dark:text-emerald-300 p-3 mb-6 rounded-lg text-xs font-bold flex items-center gap-3 animate-fade-in-down">
                        <span>✅</span> {flash.success}
                    </div>
                )}

                {/* Table */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                                    <th className="px-5 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            onChange={handleSelectAll}
                                            checked={selectedIds.length === procedures.data.length && procedures.data.length > 0}
                                        />
                                    </th>
                                    <th className="px-5 py-3 text-xs font-black uppercase text-slate-400">Trámites & Prioridad</th>
                                    <th className="px-5 py-3 text-xs font-black uppercase text-slate-400">Cliente & Contacto</th>
                                    <th className="px-5 py-3 text-xs font-black uppercase text-slate-400">Logística & Asignación</th>
                                    <th className="px-5 py-3 text-xs font-black uppercase text-slate-400">Gestión Interna</th>
                                    <th className="px-5 py-3 text-xs font-black uppercase text-slate-400 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {procedures.data.map((p) => (
                                    <tr key={p.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group ${selectedIds.includes(p.id) ? 'bg-indigo-50/30' : ''}`}>
                                        <td className="px-5 py-4">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={selectedIds.includes(p.id)}
                                                onChange={() => handleSelectOne(p.id)}
                                            />
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{p.guide || 'S/G'}</span>
                                                <span className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-tighter ${p.priority === 'Urgente' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {p.priority}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium truncate max-w-[250px] mt-0.5">
                                                {p.product} <span className="opacity-50 font-mono">(x{p.quantity})</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{p.contact_name}</div>
                                            <div className="flex flex-col gap-0.5 mt-0.5">
                                                <div className="text-xs text-indigo-500 font-bold">{p.phone}</div>
                                                <div className="text-[11px] text-slate-400 truncate max-w-[200px] italic">{p.email || p.client_id || 'Sin correo/ID'}</div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="text-xs text-slate-600 dark:text-slate-400 font-bold truncate max-w-[300px]" title={p.address}>{p.address}</div>
                                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                                <div className="flex items-center gap-1 font-bold text-slate-400">
                                                    <span>🕒</span>
                                                    <span className="text-slate-500">{p.start_date ? new Date(p.start_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}</span>
                                                    <span className="mx-0.5 opacity-30">|</span>
                                                    <span>{p.start_date ? new Date(p.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</span>
                                                    <span>-</span>
                                                    <span>{p.end_date ? new Date(p.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-slate-300">🛵</span>
                                                    <span className="font-bold text-slate-500">
                                                        {p.messenger_id ? messengers.find(m => m.id === p.messenger_id)?.name || 'Asignado' : 'Sin asignar'}
                                                    </span>
                                                </div>
                                                <span className={`px-1.5 py-0.5 rounded uppercase font-black ${p.status === 'completado' ? 'bg-emerald-50 text-emerald-600' :
                                                    p.status === 'en_ruta' ? 'bg-blue-50 text-blue-600' :
                                                        'bg-amber-50 text-amber-600'
                                                    }`}>
                                                    {p.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            {p.management_notes ? (
                                                <div className="p-1.5 bg-amber-50/50 border-l-2 border-amber-200 rounded text-xs text-amber-700 leading-tight max-w-[250px]">
                                                    {p.management_notes}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-300 italic">Sin notas</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openModal(p, true)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors" title="Ver Detalles">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                </button>
                                                <button onClick={() => openModal(p)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => handleDelete(p.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Eliminar">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {procedures.data.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-5 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-3xl opacity-20">📂</span>
                                                <p className="text-slate-400 italic text-xs">No se encontraron trámites con estos filtros.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-xs text-slate-500 font-medium">
                            Mostrando <span className="font-bold text-slate-700">{procedures.from || 0}</span> a <span className="font-bold text-slate-700">{procedures.to || 0}</span> de <span className="font-bold text-slate-700">{procedures.total}</span> registros
                        </div>
                        <div className="flex gap-1">
                            {procedures.links.map((link, i) => (
                                <button
                                    key={i}
                                    onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                    disabled={!link.url || link.active}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${link.active
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                        : link.url
                                            ? 'text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200'
                                            : 'text-slate-300 cursor-not-allowed'
                                        }`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal remains same structure but compact */}
            <Modal show={showModal} onClose={() => setShowModal(false)} maxWidth="2xl">
                <form onSubmit={submit} className="bg-white dark:bg-slate-800 rounded-2xl">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 rounded-t-2xl">
                        <h2 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-wider">
                            {viewMode ? 'Detalle del Trámite' : editingProcedure ? 'Editar Registro' : 'Nuevo Trámite'}
                        </h2>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-12 md:col-span-3">
                                <InputLabel value="N° Guía" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                <TextInput className="w-full bg-slate-50 text-sm py-2" value={form.guide} disabled readOnly />
                            </div>
                            <div className="col-span-12 md:col-span-7">
                                <InputLabel value="Producto / Trámite" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                <TextInput className="w-full text-sm py-2" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} autoFocus disabled={viewMode} />
                            </div>
                            <div className="col-span-12 md:col-span-2">
                                <InputLabel value="Cant." className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                <TextInput className="w-full text-xs py-2 text-center" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} disabled={viewMode} />
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-12 md:col-span-3">
                                <InputLabel value="ID Cliente" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                <TextInput className="w-full text-sm py-2" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} disabled={viewMode} />
                            </div>
                            <div className="col-span-12 md:col-span-5">
                                <InputLabel value="Nombre Contacto" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                <TextInput className="w-full text-sm py-2" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} disabled={viewMode} />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <InputLabel value="Teléfono" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                <TextInput className="w-full text-sm py-2" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={viewMode} />
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-4 pt-4 border-t border-slate-50">
                            <div className="col-span-12 md:col-span-8">
                                <InputLabel value="Dirección Destino" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                <TextInput className="w-full text-sm py-2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={viewMode} />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <InputLabel value="Prioridad" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                <SelectInput className="w-full text-sm py-2" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} disabled={viewMode}>
                                    <option value="Normal">Normal</option>
                                    <option value="Urgente">Urgente</option>
                                </SelectInput>
                            </div>

                            <div className="col-span-12 md:col-span-6 grid grid-cols-2 gap-2">
                                <div>
                                    <InputLabel value="Fecha Inicio" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                    <TextInput type="date" className="w-full text-sm py-1.5 px-2" value={form.start_date_day} onChange={(e) => setForm({ ...form, start_date_day: e.target.value })} disabled={viewMode} />
                                </div>
                                <div>
                                    <InputLabel value="Hora" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                    <TextInput type="time" className="w-full text-sm py-1.5 px-2" value={form.start_date_time} onChange={(e) => setForm({ ...form, start_date_time: e.target.value })} disabled={viewMode} />
                                </div>
                            </div>
                            <div className="col-span-12 md:col-span-6 grid grid-cols-2 gap-2">
                                <div>
                                    <InputLabel value="Fecha Fin" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                    <TextInput type="date" className="w-full text-sm py-1.5 px-2" value={form.end_date_day} onChange={(e) => setForm({ ...form, end_date_day: e.target.value })} disabled={viewMode} />
                                </div>
                                <div>
                                    <InputLabel value="Hora" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                    <TextInput type="time" className="w-full text-sm py-1.5 px-2" value={form.end_date_time} onChange={(e) => setForm({ ...form, end_date_time: e.target.value })} disabled={viewMode} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-12 md:col-span-8">
                                <InputLabel value="Mensajero / Operario" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                <SelectInput className="w-full text-sm py-2" value={form.messenger_id} onChange={(e) => setForm({ ...form, messenger_id: e.target.value })} disabled={viewMode}>
                                    <option value="">-- Por asignar --</option>
                                    {messengers.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </SelectInput>
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <InputLabel value="Estado" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                <SelectInput className="w-full text-sm py-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={viewMode}>
                                    <option value="pendiente">Pendiente</option>
                                    <option value="en_ruta">En Ruta</option>
                                    <option value="completado">Completado</option>
                                    <option value="cancelado">Cancelado</option>
                                </SelectInput>
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-12 md:col-span-6">
                                <InputLabel value="Notas (Incluir en Excel)" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                <textarea
                                    className="w-full border-slate-200 rounded-xl text-sm p-3 h-16 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Estas notas aparecerán en el reporte..."
                                    value={form.info}
                                    onChange={(e) => setForm({ ...form, info: e.target.value })}
                                    disabled={viewMode}
                                ></textarea>
                            </div>
                            <div className="col-span-12 md:col-span-6">
                                <InputLabel value="Observaciones de Gestión (Internas)" className="text-xs uppercase font-bold text-slate-400 mb-1" />
                                <textarea
                                    className="w-full border-slate-200 rounded-xl text-sm p-3 h-16 bg-amber-50/30 border-amber-100 focus:ring-amber-500 focus:border-amber-500"
                                    placeholder="Notas de auditoría o seguimiento interno..."
                                    value={form.management_notes}
                                    onChange={(e) => setForm({ ...form, management_notes: e.target.value })}
                                    disabled={viewMode}
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 flex justify-end gap-2 bg-slate-50 rounded-b-2xl border-t border-slate-100">
                        <SecondaryButton className="text-[9px] py-2" onClick={() => setShowModal(false)}>{viewMode ? 'Cerrar' : 'Cancelar'}</SecondaryButton>
                        {!viewMode && (
                            <PrimaryButton className="text-[9px] py-2 px-6" disabled={router.processing}>
                                {editingProcedure ? 'Guardar' : 'Crear Trámite'}
                            </PrimaryButton>
                        )}
                    </div>
                </form>
            </Modal>

            {/* Import Modal */}
            <Modal show={showImportModal} onClose={() => { setShowImportModal(false); setImportFile(null); }} maxWidth="md">
                <div className="bg-white dark:bg-slate-800 rounded-2xl">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 rounded-t-2xl">
                        <h2 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-wider">
                            Importar Trámites
                        </h2>
                        <button onClick={() => { setShowImportModal(false); setImportFile(null); }} className="text-slate-400 hover:text-slate-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <form onSubmit={handleImport} className="p-6 space-y-5">
                        {/* Template download */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 flex items-start gap-3">
                            <svg className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <div className="text-xs text-indigo-700 dark:text-indigo-300">
                                <p className="font-bold mb-1">Usa la plantilla oficial para evitar errores.</p>
                                <p className="mb-2 text-indigo-600/80 dark:text-indigo-400/80">Columnas: producto, cantidad, identificacion, contacto, telefono, email, direccion, horainicio, horafinal, prioridad, info, notas_gestion</p>
                                <p className="text-[10px] text-indigo-500/70">La guía se asigna automáticamente por el sistema.</p>
                                <a
                                    href={route('procedures.import-template')}
                                    className="inline-flex items-center gap-1.5 font-black text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Descargar plantilla
                                </a>
                            </div>
                        </div>

                        {/* File input */}
                        <div>
                            <InputLabel value="Archivo Excel (.xlsx, .xls, .csv)" className="text-[10px] uppercase font-bold text-slate-400 mb-2" />
                            <div
                                className="border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:border-indigo-500 transition-colors"
                                onClick={() => importFileRef.current?.click()}
                            >
                                {importFile ? (
                                    <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 font-bold">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {importFile.name}
                                    </div>
                                ) : (
                                    <div className="text-slate-400">
                                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                        <p className="text-xs font-bold">Haz clic para seleccionar archivo</p>
                                        <p className="text-[10px] mt-1">.xlsx · .xls · .csv</p>
                                    </div>
                                )}
                                <input
                                    ref={importFileRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={e => setImportFile(e.target.files[0] || null)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <SecondaryButton type="button" onClick={() => { setShowImportModal(false); setImportFile(null); }}>
                                Cancelar
                            </SecondaryButton>
                            <PrimaryButton type="submit" disabled={!importFile || importing} className="text-[11px]">
                                {importing ? 'Importando...' : '📥 Importar Trámites'}
                            </PrimaryButton>
                        </div>
                    </form>
                </div>
            </Modal>
        </LeaderLayout >
    );
}
