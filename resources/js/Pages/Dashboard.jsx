import React, { useState, useEffect, useRef } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import TextInput from '@/Components/TextInput';
import SelectInput from '@/Components/SelectInput';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import Modal from '@/Components/Modal';
import { toast } from 'sonner';

const getPriority = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('disponible')) return 1;
    if (s.includes('almuerzo')) return 2;
    if (s.includes('ruta')) return 3;
    if (s.includes('finalizado')) return 4;
    return 10;
};

export default function Dashboard({ messengers, dispatch_locations, beetrack_data }) {
    const { data, setData, submit, processing, errors, reset } = useForm({
        file: null,
        location_id: '',
        messenger_id: '',
        last_route: false,
        output_name: '',
    });

    const [filter, setFilter] = useState('');
    const [notificationsHistory, setNotificationsHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [activeFilters, setActiveFilters] = useState(new Set());

    const toggleFilter = (key) => {
        setActiveFilters(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };
    const [localMessengers, setLocalMessengers] = useState(messengers);
    const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());
    const [beetrackLoading, setBeetrackLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // --- Fast/Async Data Loading ---
    useEffect(() => {
        // Initial set from props
        let currentMessengers = [...messengers];
        setLocalMessengers(currentMessengers);

        // Fetch Beetrack Data asynchronously
        setBeetrackLoading(true);
        fetch(route('messenger.status.beetrack'))
            .then(res => res.json())
            .then(data => {
                if (data.beetrack_data) {
                    const normalize = (str) => {
                        if (!str) return '';
                        return String(str).toUpperCase().replace(/[^A-Z0-9]/g, '');
                    };

                    const btData = data.beetrack_data;
                    const allBt = [...(btData.activos || []), ...(btData.libres || [])];

                    // Merge Beetrack data into local messengers
                    currentMessengers = currentMessengers.map(m => {
                        let btMatch = allBt.find(item => normalize(item.unidad) === normalize(m.vehicle));
                        let beetrackInfo = null;
                        let status = m.status;
                        let currentClass = m.class_name;
                        let priority = 1;

                        if (btData.activos) {
                            const active = btData.activos.find(item => normalize(item.unidad) === normalize(m.vehicle));
                            if (active) {
                                status = 'En Ruta';
                                currentClass = 'status-en-ruta';
                                beetrackInfo = active;
                                priority = 2; // Keep at top
                            }
                        }

                        // Don't override if already marked as Finished
                        if (m.finished_info) {
                            status = 'Finalizado';
                            currentClass = 'pendiente';
                            priority = 1;
                        }

                        return {
                            ...m,
                            name: btMatch ? (btMatch.nombre || m.name) : m.name,
                            status: status,
                            class_name: currentClass,
                            beetrack_info: beetrackInfo,
                            priority: getPriority(status),
                            lat: beetrackInfo?.lat || m.lat,
                            lng: beetrackInfo?.lng || m.lng,
                        };
                    });

                    setLocalMessengers(currentMessengers);
                }
                setBeetrackLoading(false);
                setLastUpdated(new Date().toLocaleTimeString());
            })
            .catch(err => {
                console.error('Error fetching Beetrack status:', err);
                setBeetrackLoading(false);
            });
    }, [messengers]);

    const prevStatusRef = useRef({});

    const normalize = (str) => String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    const mergeBeetrack = (localList, btData) => {
        const allBt = [...(btData.activos || []), ...(btData.libres || [])];
        return localList.map(m => {
            const btMatch = allBt.find(item => normalize(item.unidad) === normalize(m.vehicle));
            const active = btData.activos?.find(item => normalize(item.unidad) === normalize(m.vehicle));
            const beetrackInfo = active ? active : (btMatch ? m.beetrack_info : null);
            const status = active ? 'En Ruta' : m.finished_info ? 'Finalizado' : m.status;
            const currentClass = active ? 'status-en-ruta' : m.finished_info ? 'pendiente' : m.class_name;
            return {
                ...m,
                name: btMatch ? (btMatch.nombre || m.name) : m.name,
                status,
                class_name: currentClass,
                beetrack_info: beetrackInfo,
                priority: getPriority(status),
                lat: beetrackInfo?.lat || m.lat,
                lng: beetrackInfo?.lng || m.lng,
            };
        });
    };

    const detectAndNotify = (newList) => {
        newList.forEach(m => {
            const prev = prevStatusRef.current[m.id];
            if (prev && prev !== m.status) {
                const icon = m.status.toLowerCase().includes('almuerzo') ? '🍔'
                    : m.status.toLowerCase().includes('finalizado') ? '🏁' : '🛵';
                const newNote = { id: Date.now() + m.id, title: m.name, description: m.status, icon, time: new Date().toLocaleTimeString() };
                setNotificationsHistory(prev => [newNote, ...prev].slice(0, 50));
                toast(`${icon} ${m.name}`, { description: m.status });
            }
            prevStatusRef.current[m.id] = m.status;
        });
    };

    useEffect(() => {
        const poll = () => {
            Promise.all([
                fetch(route('messenger.status')).then(r => r.json()),
                fetch(route('messenger.status.beetrack')).then(r => r.json()),
            ]).then(([localData, btResponse]) => {
                const btData = btResponse.beetrack_data;
                let merged = localData.messengers;
                if (btData) merged = mergeBeetrack(merged, btData);
                detectAndNotify(merged);
                setLocalMessengers(merged);
                setLastUpdated(new Date().toLocaleTimeString());
                setBeetrackLoading(false);
            }).catch(err => console.error('Polling error:', err));
        };

        const interval = setInterval(poll, 30000);
        return () => clearInterval(interval);
    }, []);

    // --- Dispatch Form Handler ---
    const handleDispatchSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('file', data.file);
        formData.append('location_id', data.location_id);
        formData.append('messenger_id', data.messenger_id);
        formData.append('last_route', data.last_route ? '1' : '0');
        formData.append('output_name', data.output_name);

        // Send token both in form data and headers for maximum compatibility
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (token) formData.append('_token', token);

        fetch(route('dispatch.store'), {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRF-TOKEN': token,
            }
        })
            .then(response => {
                if (response.ok) return response.blob();
                throw new Error('Error generador archivo');
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${data.output_name}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();

                // Clear form after success
                reset();
                if (document.querySelector('input[type="file"]')) {
                    document.querySelector('input[type="file"]').value = '';
                }
                setIsModalOpen(false);
            })
            .catch(err => alert('Error: ' + err.message));
    };

    // --- Drag and Drop Logic ---


    // --- Filtering & Sorting ---
    const getFilteredMessengers = () => {
        const locationOf = (m) => m.location === 'principal' ? '116' : (m.location || '').toLowerCase();
        const statusOf = (m) => (m.status || '').toLowerCase();

        // Group chips by category
        const locationKeys = new Set(['116', 'teusaquillo']);
        const statusKeys = new Set(['en-ruta', 'disponible', 'almuerzo', 'finalizado']);

        const activeLocationFilters = [...activeFilters].filter(k => locationKeys.has(k));
        const activeStatusFilters = [...activeFilters].filter(k => statusKeys.has(k));

        const chipMatchers = {
            '116': (m) => locationOf(m) === '116',
            'teusaquillo': (m) => locationOf(m) === 'teusaquillo',
            'en-ruta': (m) => statusOf(m) === 'en ruta',
            'disponible': (m) => statusOf(m) === 'disponible',
            'almuerzo': (m) => statusOf(m).includes('almuerzo'),
            'finalizado': (m) => statusOf(m) === 'finalizado',
        };

        return localMessengers
            .filter(m => {
                // 1. Text search
                const search = filter.toUpperCase();
                const textMatch = !filter ||
                    m.name.toUpperCase().includes(search) ||
                    m.vehicle.toUpperCase().includes(search) ||
                    statusOf(m).toUpperCase().includes(search) ||
                    locationOf(m).toUpperCase().includes(search);

                // 2. Faceted: OR within each category, AND between categories
                const locationMatch = activeLocationFilters.length === 0 ||
                    activeLocationFilters.some(k => chipMatchers[k]?.(m));
                const statusMatch = activeStatusFilters.length === 0 ||
                    activeStatusFilters.some(k => chipMatchers[k]?.(m));

                return textMatch && locationMatch && statusMatch;
            })
            .sort((a, b) => {
                if (a.priority !== b.priority) return a.priority - b.priority;
                return a.name.localeCompare(b.name);
            });
    };

    const selectMessenger = (m) => {
        setData(prev => ({
            ...prev,
            messenger_id: m.id,
            output_name: `${m.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '')}`
        }));
    };

    const openAssignModal = (m) => {
        selectMessenger(m);
        setIsModalOpen(true);
    };

    return (
        <LeaderLayout title="Control Center">
            <Head title="Control Center" />

            {/* Sticky Header with Filters and Stats */}
            <div className="sticky top-16 z-[1000] backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-indigo-100 dark:border-indigo-900/50 shadow-sm transition-all duration-300">
                <div className="max-w-[1800px] mx-auto p-3 sm:p-4">
                    <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4 w-full">
                        {/* Search and Filters */}
                        <div className="flex-1 w-full flex flex-col md:flex-row gap-3 items-start md:items-center">
                            <div className="relative w-full lg:max-w-md group shrink-0">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                    <svg className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </div>
                                <TextInput
                                    type="text"
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    placeholder="Buscar..."
                                    className="pl-10 w-full"
                                />
                                {filter && (
                                    <button
                                        onClick={() => setFilter('')}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                )}
                            </div>

                            {/* Chips */}
                            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden lg:block shrink-0">Sede:</span>
                                <FilterBadge active={activeFilters.has('116')} onClick={() => toggleFilter('116')} label="Sede 116" color="blue" />
                                <FilterBadge active={activeFilters.has('teusaquillo')} onClick={() => toggleFilter('teusaquillo')} label="Teusaquillo" color="teal" />

                                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden lg:block shrink-0">Estado:</span>
                                <FilterBadge active={activeFilters.has('en-ruta')} onClick={() => toggleFilter('en-ruta')} label="En Ruta" color="red" />
                                <FilterBadge active={activeFilters.has('disponible')} onClick={() => toggleFilter('disponible')} label="Disponible" color="emerald" />
                                <FilterBadge active={activeFilters.has('almuerzo')} onClick={() => toggleFilter('almuerzo')} label="Almuerzo" color="amber" />
                                <FilterBadge active={activeFilters.has('finalizado')} onClick={() => toggleFilter('finalizado')} label="Finalizado" color="violet" />

                                {activeFilters.size > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilters(new Set())}
                                        className="ml-2 px-2 py-1 rounded-full text-[10px] font-bold border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-700 cursor-pointer transition-all duration-200 flex items-center gap-1"
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Stats and Notifications */}
                        <div className="flex items-center gap-4 w-full xl:w-auto justify-between xl:justify-end border-t xl:border-t-0 pt-3 xl:pt-0 border-slate-100 dark:border-slate-800">
                            <div className="flex gap-2">
                                <div className="px-3 py-1.5 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase mr-2">Total:</span>
                                    <span className="text-sm font-black">{localMessengers.length}</span>
                                </div>
                                <div className="px-3 py-1.5 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 border-l-2 border-l-red-500">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase mr-2">Ruta:</span>
                                    <span className="text-sm font-black">{localMessengers.filter(m => m.status === 'En Ruta').length}</span>
                                </div>
                            </div>

                            {/* Notifications Bell */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowHistory(!showHistory)}
                                    className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all relative border border-indigo-100 dark:border-indigo-800"
                                >
                                    <span className="text-xl">🔔</span>
                                    {notificationsHistory.length > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black shadow-lg border-2 border-white dark:border-slate-900">
                                            {notificationsHistory.length}
                                        </span>
                                    )}
                                </button>

                                {showHistory && (
                                    <div className="absolute right-0 mt-3 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[1100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                            <h3 className="font-black text-sm uppercase tracking-wider">Notificaciones</h3>
                                            <button onClick={() => setNotificationsHistory([])} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 uppercase tracking-widest">Limpiar</button>
                                        </div>
                                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {notificationsHistory.length === 0 ? (
                                                <div className="p-12 text-center text-slate-400">
                                                    <p className="text-2xl mb-2">📭</p>
                                                    <p className="text-xs font-medium italic">Sin actividad</p>
                                                </div>
                                            ) : (
                                                notificationsHistory.map(note => (
                                                    <div key={note.id} className="p-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                                        <div className="flex gap-4">
                                                            <div className="shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                                                                {note.icon}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between items-start mb-0.5">
                                                                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{note.title}</p>
                                                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded uppercase tracking-tighter shrink-0">{note.time}</span>
                                                                </div>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{note.description}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Main Content */}
            <div className="max-w-[1800px] mx-auto p-3 sm:p-4">
                {beetrackLoading && (
                    <div className="flex justify-center mb-4">
                        <span className="text-[10px] animate-pulse text-indigo-500 font-bold tracking-widest uppercase">
                            Consultando rutas en Beetrack...
                        </span>
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    {getFilteredMessengers().map(m => (
                        <MessengerCard
                            key={m.id}
                            m={m}
                            onSelect={() => selectMessenger(m)}
                            onAssign={() => openAssignModal(m)}
                            isSelected={data.messenger_id === m.id}
                        />
                    ))}
                </div>
            </div>

            {/* Dispatch Modal */}
            <Modal show={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleDispatchSubmit} className="p-6">
                    <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                        Procesar Ruta
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Selecciona el archivo Excel y la sede para generar la ruta.
                    </p>

                    <div className="mt-6 space-y-4">
                        <div>
                            <InputLabel htmlFor="file" value="Archivo Excel" />
                            <input
                                type="file"
                                id="file"
                                onChange={(e) => setData('file', e.target.files[0])}
                                className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                required
                            />
                        </div>

                        <div>
                            <InputLabel htmlFor="location_id" value="Sede de Despacho" />
                            <SelectInput
                                id="location_id"
                                value={data.location_id}
                                onChange={(e) => setData('location_id', e.target.value)}
                                className="mt-1 block w-full"
                                required
                            >
                                <option value="">Selecciona una sede</option>
                                {dispatch_locations.map((loc) => (
                                    <option key={loc.id} value={loc.id}>
                                        {loc.name}
                                    </option>
                                ))}
                            </SelectInput>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="last_route"
                                checked={data.last_route}
                                onChange={(e) => setData('last_route', e.target.checked)}
                                className="rounded border-slate-300 text-indigo-600 shadow-sm focus:ring-indigo-500"
                            />
                            <InputLabel htmlFor="last_route" value="¿Es la última ruta?" />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </SecondaryButton>
                        <PrimaryButton disabled={processing}>
                            {processing ? 'Procesando...' : 'Generar Rutero'}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>
        </LeaderLayout>
    );
}

function MessengerCard({ m, onSelect, onAssign, isSelected }) {
    const config = {
        'status-en-ruta': { color: 'red', avatar: 'bg-red-500', rowBg: 'bg-red-50/60 dark:bg-red-900/10', border: 'border-l-4 border-l-red-500' },
        'status-almuerzo': { color: 'amber', avatar: 'bg-amber-400', rowBg: 'bg-amber-50/60 dark:bg-amber-900/10', border: 'border-l-4 border-l-amber-400' },
        'status-libre': { color: 'emerald', avatar: 'bg-emerald-500', rowBg: 'bg-white dark:bg-slate-800', border: 'border-l-4 border-l-emerald-500' },
        'pendiente': { color: 'slate', avatar: 'bg-slate-400', rowBg: 'bg-slate-50/80 dark:bg-slate-800', border: 'border-l-4 border-l-slate-300' },
    }[m.class_name] || { color: 'slate', avatar: 'bg-slate-400', rowBg: 'bg-white dark:bg-slate-800', border: 'border-l-4 border-gray-200' };

    const initials = m.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

    return (
        <div
            onClick={onSelect}
            className={`
                ${config.rowBg} ${config.border}
                border-y border-r border-slate-100 dark:border-slate-700/60
                rounded-xl shadow-sm cursor-pointer transition-all duration-200
                hover:shadow-md active:scale-[0.99]
                ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900' : ''}
            `}
        >
            {/* ── Mobile Layout ── */}
            <div className="flex sm:hidden items-center gap-3 px-3 py-3 min-h-[64px]">
                {/* Avatar */}
                <div className={`shrink-0 w-10 h-10 rounded-full ${config.avatar} flex items-center justify-center shadow-sm`}>
                    <span className="text-white text-sm font-black tracking-tight">{initials}</span>
                </div>

                {/* Name + status row */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate leading-tight">
                            {m.name}
                        </h3>
                        <StatusBadge status={m.status} color={config.color} size="sm" />
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {m.location && (
                            <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider ${m.location === 'principal' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'}`}>
                                {m.location === 'principal' ? '116' : m.location.toUpperCase()}
                            </span>
                        )}
                        <span className="font-mono text-[9px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 font-bold">
                            {m.vehicle}
                        </span>
                        {m.beetrack_info && (
                            <span className="text-[9px] font-bold text-red-500">📍 {m.beetrack_info.progreso_str}</span>
                        )}
                        {m.finished_info && (
                            <span className="text-[9px] font-bold text-emerald-600">🏁 {m.finished_info.hora_cierre}</span>
                        )}
                    </div>
                </div>

                {/* Assign button */}
                <button
                    onClick={(e) => { e.stopPropagation(); onAssign(); }}
                    className="shrink-0 w-10 h-10 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-sm active:scale-90 transition-all"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </button>
            </div>

            {/* ── Desktop Layout ── */}
            <div className="hidden sm:flex items-center gap-4 px-4 py-3">
                {/* Avatar + Name */}
                <div className="flex items-center gap-3 w-1/3 min-w-[220px]">
                    <div className={`shrink-0 w-9 h-9 rounded-full ${config.avatar} flex items-center justify-center shadow-sm`}>
                        <span className="text-white text-xs font-black tracking-tight">{initials}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate leading-tight">
                            {m.name}
                        </h3>
                        <div className="flex items-center gap-1.5">
                            {m.location && (
                                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wider whitespace-nowrap ${m.location === 'principal' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'}`}>
                                    {m.location === 'principal' ? '116' : m.location.toUpperCase()}
                                </span>
                            )}
                            <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 font-bold tracking-wider">
                                {m.vehicle}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Middle columns */}
                <div className="flex-1 flex items-center justify-between gap-4 lg:gap-6 px-4 lg:px-8">
                    {/* Turno */}
                    <div className="hidden lg:flex flex-col items-center gap-0.5 min-w-[90px]">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Turno</span>
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap">{m.shift_info}</span>
                    </div>

                    {/* Almuerzo */}
                    <div className="flex flex-col items-center gap-0.5 min-w-[90px]">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden xl:block">Almuerzo</span>
                        <div className="flex items-center gap-1">
                            <span className="text-slate-300 xl:hidden text-sm">🍽️</span>
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap">{m.lunch_range}</span>
                        </div>
                    </div>

                    {/* Reporte */}
                    <div className="hidden sm:flex flex-col items-center gap-0.5 min-w-[90px]">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden xl:block">Reporte</span>
                        {m.finished_info ? (
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800 whitespace-nowrap">
                                🏁 {m.finished_info.hora_cierre}
                            </span>
                        ) : (
                            <span className="text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-700/50 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-600 whitespace-nowrap">
                                Pendiente
                            </span>
                        )}
                    </div>

                    {/* Beetrack progress */}
                    <div className="flex items-center justify-center min-w-[120px] max-w-[200px] w-full">
                        {m.beetrack_info ? (
                            <div className="w-full flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-red-500 tracking-wider uppercase">En Ruta</span>
                                    <span className="text-[9px] font-mono font-bold text-slate-500">{m.beetrack_info.progreso_str}</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all duration-500" style={{ width: `${m.beetrack_info.porcentaje}%` }} />
                                </div>
                            </div>
                        ) : (
                            <span className="text-slate-300 dark:text-slate-600 italic text-xs">Sin actividad</span>
                        )}
                    </div>
                </div>

                {/* Status + Action */}
                <div className="flex flex-col items-end gap-2 min-w-[120px]">
                    <StatusBadge status={m.status} color={config.color} />
                    <button
                        onClick={(e) => { e.stopPropagation(); onAssign(); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Asignar
                    </button>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status, color, size = 'md' }) {
    const colors = {
        red: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
        amber: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
        emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
        slate: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
    };

    const sizing = size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]';

    return (
        <span className={`rounded-full font-black border ${colors[color]} ${sizing} uppercase tracking-wide whitespace-nowrap`}>
            {status}
        </span>
    );
}

function FilterBadge({ active, onClick, label, color }) {
    const defaultClasses = "px-3 py-2 rounded-full text-xs font-bold border cursor-pointer transition-all duration-200 whitespace-nowrap shadow-sm min-h-[36px] flex items-center";

    const colors = {
        blue: active ? 'bg-blue-500 text-white border-blue-600 shadow-blue-500/30 ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        teal: active ? 'bg-teal-500 text-white border-teal-600 shadow-teal-500/30 ring-2 ring-teal-500 ring-offset-1 dark:ring-offset-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        red: active ? 'bg-red-500 text-white border-red-600 shadow-red-500/30 ring-2 ring-red-500 ring-offset-1 dark:ring-offset-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        emerald: active ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/30 ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        amber: active ? 'bg-amber-500 text-white border-amber-600 shadow-amber-500/30 ring-2 ring-amber-500 ring-offset-1 dark:ring-offset-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        violet: active ? 'bg-violet-500 text-white border-violet-600 shadow-violet-500/30 ring-2 ring-violet-500 ring-offset-1 dark:ring-offset-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    };

    return (
        <button type="button" onClick={onClick} className={`${defaultClasses} ${colors[color]}`}>
            {label}
        </button>
    );
}
