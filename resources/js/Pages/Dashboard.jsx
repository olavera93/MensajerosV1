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
    const [sede, setSede] = useState('all');
    const [stateFilter, setStateFilter] = useState(null);
    const [showAllRoute, setShowAllRoute] = useState(false);
    const [localMessengers, setLocalMessengers] = useState(messengers);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [beetrackLoading, setBeetrackLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [alerts, setAlerts] = useState([]);
    const [alertLimits, setAlertLimits] = useState(null);
    const [availableSince, setAvailableSince] = useState({});
    const [routeActivity, setRouteActivity] = useState({});
    const [refreshing, setRefreshing] = useState(false);
    const pollRef = useRef(null);

    // Reloj para los tiempos en vivo (sin ruta, almuerzo, última actualización)
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const tick = setInterval(() => setNow(Date.now()), 5000);
        return () => clearInterval(tick);
    }, []);
    const seenAlertsRef = useRef(null);

    // Avisa solo las alertas nuevas; en la primera carga se muestran sin notificar
    const updateAlerts = (list = []) => {
        const keys = new Set(list.map(a => `${a.type}-${a.messenger_id}`));
        if (seenAlertsRef.current) {
            list.filter(a => !seenAlertsRef.current.has(`${a.type}-${a.messenger_id}`)).forEach(a => {
                const icon = a.type === 'idle' ? '⏸️' : '🏠';
                const description = alertText(a);
                setNotificationsHistory(prev => [{ id: Date.now() + a.messenger_id, title: a.name, description, icon, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
                toast.warning(`${icon} ${a.name}`, { description });
            });
        }
        seenAlertsRef.current = keys;
        setAlerts(list);
    };

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
                updateAlerts(data.alerts);
                setAlertLimits(data.alert_limits);
                setAvailableSince(data.available_since || {});
                setRouteActivity(data.route_activity || {});
                setBeetrackLoading(false);
                setLastUpdated(new Date());
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
                updateAlerts(btResponse.alerts);
                setAlertLimits(btResponse.alert_limits);
                setAvailableSince(btResponse.available_since || {});
                setRouteActivity(btResponse.route_activity || {});
                setLastUpdated(new Date());
                setBeetrackLoading(false);
                setRefreshing(false);
                setNow(Date.now());
            }).catch(err => {
                console.error('Polling error:', err);
                setRefreshing(false);
            });
        };

        pollRef.current = poll;
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

    const refreshNow = () => {
        setRefreshing(true);
        pollRef.current?.();
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

    // --- Agrupación por estado ---
    const alertsById = Object.fromEntries(alerts.map(a => [a.messenger_id, a]));
    const groupOf = (m) => {
        if (m.finished_info) return 'finalizados';
        if (m.status === 'En Ruta') return 'ruta';
        if (m.status === 'En Almuerzo') return 'almuerzo';
        if (m.shift_start && new Date(m.shift_start).getTime() > now) return 'por-iniciar';
        return 'disponibles';
    };

    const search = filter.trim().toUpperCase();
    const visible = localMessengers.filter(m =>
        (sede === 'all' || m.location === sede) &&
        (!search || m.name.toUpperCase().includes(search) || String(m.vehicle || '').toUpperCase().includes(search))
    );

    const groups = { disponibles: [], ruta: [], almuerzo: [], 'por-iniciar': [], finalizados: [] };
    visible.forEach(m => groups[groupOf(m)].push(m));

    // Disponibles: quien lleva más tiempo sin ruta primero; el personal de apoyo al final
    const idleMs = (m) => availableSince[m.id] ? now - new Date(availableSince[m.id].since).getTime() : -1;
    const byName = (a, b) => a.name.localeCompare(b.name);
    groups.disponibles.sort((a, b) => (b.in_dispatchtrack - a.in_dispatchtrack) || (idleMs(b) - idleMs(a)) || byName(a, b));
    groups.ruta.sort((a, b) => ((alertsById[b.id]?.minutes ?? -1) - (alertsById[a.id]?.minutes ?? -1)) || byName(a, b));
    groups.almuerzo.sort((a, b) => new Date(a.lunch_end) - new Date(b.lunch_end));
    groups['por-iniciar'].sort((a, b) => new Date(a.shift_start) - new Date(b.shift_start));
    groups.finalizados.sort(byName);

    const alerted = visible.filter(m => alertsById[m.id]);
    const nextId = groups.disponibles.find(m => m.in_dispatchtrack && availableSince[m.id])?.id;
    const updatedAgo = Math.max(0, Math.round((now - lastUpdated.getTime()) / 1000));
    const toggleState = (key) => setStateFilter(prev => prev === key ? null : key);

    const cardProps = (m) => ({
        m,
        now,
        isSelected: data.messenger_id === m.id,
        onSelect: () => selectMessenger(m),
        onAssign: () => openAssignModal(m),
    });
    const renderCard = (m, group) => {
        if (group === 'disponibles') return <AvailableCard key={m.id} {...cardProps(m)} idle={availableSince[m.id]} next={m.id === nextId} />;
        if (group === 'ruta') return <RouteCard key={m.id} {...cardProps(m)} alert={alertsById[m.id]} activity={routeActivity[m.id]} />;
        if (group === 'almuerzo') return <LunchCard key={m.id} {...cardProps(m)} />;
        return <CompactCard key={m.id} {...cardProps(m)} group={group} />;
    };

    const routeLimit = 8;
    const routeShown = showAllRoute ? groups.ruta : groups.ruta.slice(0, routeLimit);

    return (
        <LeaderLayout title="Control Center">
            <Head title="Control Center" />

            {/* Encabezado: búsqueda, sede, actualización y contadores que filtran */}
            <div className="sm:sticky sm:top-16 relative z-[1000] backdrop-blur-xl bg-white/85 dark:bg-slate-900/85 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-[1800px] mx-auto px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <label htmlFor="dashboard-search" className="relative flex-1 min-w-[220px] max-w-md">
                            <span className="sr-only">Buscar mensajero o placa</span>
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                            <TextInput
                                id="dashboard-search"
                                type="search"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                placeholder="Buscar mensajero o placa"
                                className="pl-10 w-full h-10"
                            />
                        </label>

                        <div role="group" aria-label="Sede" className="inline-flex p-0.5 gap-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            {[['all', 'Todas'], ['principal', 'Sede 116'], ['teusaquillo', 'Teusaquillo']].map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={sede === key}
                                    onClick={() => setSede(key)}
                                    className={`h-9 px-3 sm:px-4 rounded-lg text-sm transition-colors ${sede === key
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-sm'
                                        : 'text-slate-600 dark:text-slate-300 font-semibold hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                            <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                <span className={`w-2 h-2 rounded-full ${beetrackLoading ? 'bg-slate-400 animate-pulse' : 'bg-emerald-500'}`} />
                                {beetrackLoading ? 'Consultando DispatchTrack…' : `Actualizado hace ${updatedAgo < 60 ? `${updatedAgo} s` : `${Math.floor(updatedAgo / 60)} min`}`}
                            </span>
                            <button
                                type="button"
                                onClick={refreshNow}
                                aria-label="Actualizar ahora"
                                className="h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                                <svg className={`w-[18px] h-[18px] ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
                            </button>

                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowHistory(!showHistory)}
                                    aria-label="Notificaciones"
                                    className="h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 relative"
                                >
                                    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                                    {notificationsHistory.length > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-black border-2 border-white dark:border-slate-900">
                                            {notificationsHistory.length}
                                        </span>
                                    )}
                                </button>

                                {showHistory && (
                                    <div className="absolute right-0 mt-3 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[1100] overflow-hidden">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                            <h3 className="font-black text-sm uppercase tracking-wider">Notificaciones</h3>
                                            <button onClick={() => setNotificationsHistory([])} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">Limpiar</button>
                                        </div>
                                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {notificationsHistory.length === 0 ? (
                                                <p className="p-10 text-center text-sm text-slate-500">Sin actividad reciente</p>
                                            ) : (
                                                notificationsHistory.map(note => (
                                                    <div key={note.id} className="p-4 border-b border-slate-100 dark:border-slate-700/50 flex gap-3">
                                                        <div className="shrink-0 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-lg">{note.icon}</div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{note.title}</p>
                                                                <span className="text-[11px] text-slate-500 shrink-0">{note.time}</span>
                                                            </div>
                                                            <p className="text-xs text-slate-600 dark:text-slate-400">{note.description}</p>
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

                    <div role="group" aria-label="Filtrar por estado" className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                        {alerted.length > 0 ? (
                            <CounterPill
                                active={stateFilter === 'alertas'}
                                onClick={() => toggleState('alertas')}
                                tone="alert"
                                label="Alertas"
                                count={alerted.length}
                            />
                        ) : (
                            <span className="shrink-0 h-10 px-3.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 text-sm font-bold flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                                Sin alertas
                            </span>
                        )}
                        {STATES.map(s => (
                            <CounterPill
                                key={s.key}
                                active={stateFilter === s.key}
                                onClick={() => toggleState(s.key)}
                                dot={s.dot}
                                label={s.label}
                                count={groups[s.key].length}
                            />
                        ))}
                    </div>

                    {alertLimits && (
                        <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 -mt-1">
                            Alertas: {alertLimits.idle_minutes} min en ruta sin gestionar guías ({alertLimits.first_guide_minutes} min para la primera) · {alertLimits.return_minutes} min desde la última entrega sin marcar el retorno a la sede.
                        </p>
                    )}
                </div>
            </div>

            <div className="max-w-[1800px] mx-auto px-3 sm:px-6 py-5">
                {stateFilter ? (
                    <Section
                        title={stateFilter === 'alertas' ? 'Con alerta' : STATES.find(s => s.key === stateFilter).label}
                        dot={stateFilter === 'alertas' ? 'bg-amber-500' : STATES.find(s => s.key === stateFilter).dot}
                        count={(stateFilter === 'alertas' ? alerted : groups[stateFilter]).length}
                        action={<button type="button" onClick={() => setStateFilter(null)} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Ver todos los estados</button>}
                    >
                        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
                            {(stateFilter === 'alertas' ? alerted : groups[stateFilter]).map(m => renderCard(m, stateFilter === 'alertas' ? groupOf(m) : stateFilter))}
                        </div>
                        {(stateFilter === 'alertas' ? alerted : groups[stateFilter]).length === 0 && <EmptyNote>No hay mensajeros en este estado.</EmptyNote>}
                    </Section>
                ) : (
                    <div className="flex flex-col gap-5">
                        <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start">
                            <Section title="Disponibles" dot="bg-emerald-500" count={groups.disponibles.length} hint="Más tiempo sin ruta primero">
                                {groups.disponibles.map(m => renderCard(m, 'disponibles'))}
                                {groups.disponibles.length === 0 && <EmptyNote>Nadie disponible en este momento.</EmptyNote>}
                            </Section>

                            <Section title="En ruta" dot="bg-red-500" count={groups.ruta.length} hint="Con alerta primero">
                                {routeShown.map(m => renderCard(m, 'ruta'))}
                                {groups.ruta.length === 0 && <EmptyNote>Nadie en ruta.</EmptyNote>}
                                {groups.ruta.length > routeLimit && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllRoute(v => !v)}
                                        className="h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                                    >
                                        {showAllRoute ? 'Ver menos' : `Ver ${groups.ruta.length - routeLimit} más en ruta`}
                                    </button>
                                )}
                            </Section>

                            <Section title="En almuerzo" dot="bg-amber-500" count={groups.almuerzo.length} hint="Próximo en volver primero">
                                {groups.almuerzo.map(m => renderCard(m, 'almuerzo'))}
                                {groups.almuerzo.length === 0 && <EmptyNote>Nadie en almuerzo.</EmptyNote>}
                            </Section>
                        </div>

                        <CollapsedGroup title="Por iniciar turno" items={groups['por-iniciar']} render={m => `${m.name} · ${fmtTime(m.shift_start)}`} />
                        <CollapsedGroup title="Finalizados" items={groups.finalizados} tone="violet" render={m => `${m.name} · cerró ${m.finished_info?.hora_cierre ?? ''}`} />
                    </div>
                )}
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

const STATES = [
    { key: 'disponibles', label: 'Disponibles', dot: 'bg-emerald-500' },
    { key: 'ruta', label: 'En ruta', dot: 'bg-red-500' },
    { key: 'almuerzo', label: 'Almuerzo', dot: 'bg-amber-500' },
    { key: 'por-iniciar', label: 'Por iniciar', dot: 'bg-slate-400' },
    { key: 'finalizados', label: 'Finalizados', dot: 'bg-violet-500' },
];

const SEDE_LABEL = { principal: 'Sede 116', teusaquillo: 'Teusaquillo' };
const IDLE_REASON = { route: 'fin de ruta', lunch: 'fin de almuerzo', shift: 'inicio de turno' };

const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '';

// Duración legible: "12 min" o "1 h 05 min"
function fmtDuration(ms) {
    const mins = Math.max(0, Math.floor(ms / 60000));
    return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}

function alertText(a) {
    if (a.type === 'return') {
        return `Terminó sus entregas a las ${a.since} y no ha marcado el retorno a ${SEDE_LABEL[a.return_to] || a.return_to}`;
    }
    return a.first_guide
        ? `Inició la ruta a las ${a.since} y no ha gestionado ninguna guía`
        : `Sin gestionar guías desde las ${a.since}`;
}

function CounterPill({ active, onClick, label, count, dot, tone }) {
    const alert = tone === 'alert';
    const base = 'shrink-0 h-10 px-3.5 rounded-full border text-sm flex items-center gap-2 transition-colors';
    const look = active
        ? (alert ? 'bg-amber-500 border-amber-500 text-white font-bold' : 'bg-indigo-600 border-indigo-600 text-white font-bold')
        : (alert
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold hover:bg-amber-100'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700');

    return (
        <button type="button" aria-pressed={active} onClick={onClick} className={`${base} ${look}`}>
            {alert ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4" /><path d="M12 17.5v.01" /></svg>
            ) : (
                <span className={`w-2.5 h-2.5 rounded-full ${dot} ${active ? 'ring-2 ring-white/70' : ''}`} />
            )}
            {label}
            <span className={`font-black ${active ? 'text-white' : alert ? '' : 'text-slate-900 dark:text-white'}`}>{count}</span>
        </button>
    );
}

function Section({ title, dot, count, hint, action, children }) {
    return (
        <section className="flex flex-col gap-3 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                    {title}
                    <span className="font-semibold text-slate-500 dark:text-slate-400">{count}</span>
                </h2>
                {action || (hint && <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>)}
            </div>
            {children}
        </section>
    );
}

function EmptyNote({ children }) {
    return (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {children}
        </p>
    );
}

function CollapsedGroup({ title, items, render, tone }) {
    const chip = tone === 'violet'
        ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-300'
        : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300';

    return (
        <details className="group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <summary className="list-none cursor-pointer px-4 py-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 [&::-webkit-details-marker]:hidden">
                <svg className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                <span className="text-[15px] font-extrabold text-slate-900 dark:text-white">{title}</span>
                <span className="font-semibold text-slate-500 dark:text-slate-400">{items.length}</span>
                <span className="flex flex-wrap gap-1.5 group-open:hidden">
                    {items.slice(0, 6).map(m => (
                        <span key={m.id} className={`px-2.5 py-1 rounded-full text-xs font-medium ${chip}`}>{render(m)}</span>
                    ))}
                    {items.length > 6 && <span className="px-2 py-1 text-xs text-slate-500">+{items.length - 6}</span>}
                </span>
            </summary>
            <ul className="px-4 pb-4 grid gap-2 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
                {items.map(m => (
                    <li key={m.id} className={`px-3 py-2 rounded-xl text-sm font-medium ${chip}`}>{render(m)}</li>
                ))}
                {items.length === 0 && <li className="text-sm text-slate-500">Nadie por ahora.</li>}
            </ul>
        </details>
    );
}

// Partes comunes de las tarjetas
function Avatar({ name, className }) {
    const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    return (
        <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black ${className}`}>
            {initials}
        </span>
    );
}

function Identity({ m, avatar, right }) {
    return (
        <div className="flex items-center gap-3">
            <Avatar name={m.name} className={avatar} />
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-[15px] font-bold text-slate-900 dark:text-white truncate">{m.name}</span>
                <span className="flex gap-1.5 font-mono text-[11px] font-bold">
                    <span className={`px-1.5 py-0.5 rounded-md ${m.location === 'teusaquillo'
                        ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                        {m.location === 'teusaquillo' ? 'TEUSAQUILLO' : '116'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{m.vehicle}</span>
                </span>
            </div>
            {right}
        </div>
    );
}

function cardClass(isSelected, border = 'border-slate-200 dark:border-slate-700') {
    return `rounded-2xl border ${border} bg-white dark:bg-slate-800 shadow-sm cursor-pointer transition-shadow hover:shadow-md ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900' : ''}`;
}

function AssignButton({ onAssign, primary }) {
    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAssign(); }}
            className={primary
                ? 'h-11 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm'
                : 'h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}
        >
            {primary ? 'Asignar ruta' : 'Asignar'}
        </button>
    );
}

function AvailableCard({ m, now, idle, next, isSelected, onSelect, onAssign }) {
    // Personal de apoyo: no hace rutas en DispatchTrack
    if (!m.in_dispatchtrack) {
        return (
            <div onClick={onSelect} className={`${cardClass(isSelected, 'border-dashed border-slate-300 dark:border-slate-600')} !bg-slate-50 dark:!bg-slate-800/60 px-4 py-3 flex items-center gap-3`}>
                <Avatar name={m.name} className="bg-slate-400 dark:bg-slate-600" />
                <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{m.name}</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">Apoyo · no usa DispatchTrack{m.shift_end ? ` · turno hasta ${fmtTime(m.shift_end)}` : ''}</span>
                </div>
            </div>
        );
    }

    const waitMs = idle ? now - new Date(idle.since).getTime() : null;
    const leftMs = m.shift_end ? new Date(m.shift_end).getTime() - now : null;

    return (
        <div onClick={onSelect} className={`${cardClass(isSelected, next ? 'border-indigo-300 dark:border-indigo-700' : undefined)} p-4 flex flex-col gap-3.5`}>
            <Identity
                m={m}
                avatar="bg-emerald-600"
                right={next && <span className="shrink-0 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 text-xs font-bold">Siguiente</span>}
            />
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Sin ruta</span>
                    <span className={`font-mono text-lg font-bold ${waitMs === null ? 'text-slate-400' : waitMs >= 3600000 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {waitMs === null ? '—' : fmtDuration(waitMs)}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                        {idle ? `desde ${IDLE_REASON[idle.reason] || idle.reason} · ${fmtTime(idle.since)}` : 'sin datos de DispatchTrack'}
                    </span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Turno restante</span>
                    <span className={`font-mono text-lg font-bold ${leftMs !== null && leftMs <= 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                        {leftMs === null ? '—' : leftMs > 0 ? fmtDuration(leftMs) : 'Terminó'}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">{m.shift_end ? `${leftMs > 0 ? 'hasta' : 'a las'} ${fmtTime(m.shift_end)}` : 'sin turno'}</span>
                </div>
            </div>
            <AssignButton onAssign={onAssign} primary />
        </div>
    );
}

function RouteCard({ m, now, alert, activity, isSelected, onSelect, onAssign }) {
    const info = m.beetrack_info;
    const critical = alert && alert.minutes >= alert.threshold * 1.5;
    const meta = activity
        ? `${activity.last_at ? `Última guía hace ${fmtDuration(now - new Date(activity.last_at).getTime())}` : 'Sin guías gestionadas'} · inició ${fmtTime(activity.started_at)}`
        : null;

    return (
        <div onClick={onSelect} className={`${cardClass(isSelected, alert ? 'border-amber-300 dark:border-amber-700' : undefined)} px-4 py-3.5 flex flex-col gap-2.5`}>
            <Identity
                m={m}
                avatar="bg-red-600"
                right={info && <span className="shrink-0 font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{info.progreso_str}</span>}
            />
            {info && (
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" role="progressbar" aria-valuenow={info.porcentaje} aria-valuemin="0" aria-valuemax="100" aria-label="Guías gestionadas">
                    <div className="h-full rounded-full bg-red-500 transition-all duration-500" style={{ width: `${info.porcentaje}%` }} />
                </div>
            )}
            {alert && (
                <div className={`flex items-start gap-2 px-2.5 py-2 rounded-xl text-[13px] font-semibold ${critical
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200'}`}>
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4" /><path d="M12 17.5v.01" /></svg>
                    <span className="flex-1">{alertText(alert)}</span>
                    <span className="font-mono font-bold whitespace-nowrap">{alert.minutes} min</span>
                </div>
            )}
            <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-slate-600 dark:text-slate-400">{meta}</span>
                <AssignButton onAssign={onAssign} />
            </div>
        </div>
    );
}

function LunchCard({ m, now, isSelected, onSelect, onAssign }) {
    const start = m.lunch_start ? new Date(m.lunch_start).getTime() : null;
    const end = m.lunch_end ? new Date(m.lunch_end).getTime() : null;
    const pct = start && end && end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0;

    return (
        <div onClick={onSelect} className={`${cardClass(isSelected)} px-4 py-3.5 flex flex-col gap-2.5`}>
            <div className="flex items-center gap-3">
                <Avatar name={m.name} className="bg-amber-600" />
                <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-[15px] font-bold text-slate-900 dark:text-white truncate">{m.name}</span>
                    <span className="text-[13px] text-slate-600 dark:text-slate-400">{end ? `Regresa a las ${fmtTime(m.lunch_end)}` : m.lunch_range}</span>
                </div>
                {end && (
                    <span className="shrink-0 flex flex-col items-end">
                        <span className="font-mono text-base font-bold text-amber-800 dark:text-amber-300">{fmtDuration(Math.max(0, end - now))}</span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">restantes</span>
                    </span>
                )}
            </div>
            <div className="h-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 overflow-hidden">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// Por iniciar y finalizados, cuando se filtran por su contador
function CompactCard({ m, group, isSelected, onSelect, onAssign }) {
    const finished = group === 'finalizados';
    return (
        <div onClick={onSelect} className={`${cardClass(isSelected)} px-4 py-3 flex items-center gap-3`}>
            <Avatar name={m.name} className={finished ? 'bg-violet-600' : 'bg-slate-500'} />
            <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{m.name}</span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                    {finished ? `Cerró a las ${m.finished_info?.hora_cierre ?? ''}` : `Turno inicia ${fmtTime(m.shift_start)}`}
                </span>
            </div>
            {!finished && m.in_dispatchtrack && <AssignButton onAssign={onAssign} />}
        </div>
    );
}
