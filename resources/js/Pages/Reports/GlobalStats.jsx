import React, { useState, useEffect, useCallback } from 'react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import { Head } from '@inertiajs/react';
import TextInput from '@/Components/TextInput';
import MessengerSearchSelect from '@/Components/MessengerSearchSelect';

const today = () => new Date().toISOString().slice(0, 10);

function CheckCell({ ok }) {
    return ok
        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-black text-sm">✓</span>
        : <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400 font-black text-sm">✗</span>;
}

function fmtDate(iso) {
    // "2026-07-11" → "Vie 11 jul"
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function GlobalStats({ filters, messengers }) {
    const [startDate, setStartDate] = useState(filters?.start_date || '');
    const [endDate, setEndDate] = useState(filters?.end_date || '');
    const [messengerId, setMessengerId] = useState(filters?.messenger_id || '');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    // ── Alertas (comparte filtros con las estadísticas) ───────────────────────
    const [alertData, setAlertData] = useState(null);
    const [alertLoading, setAlertLoading] = useState(true);

    const fetchAlerts = useCallback(async () => {
        setAlertLoading(true);
        setAlertFilter('all');
        try {
            const params = new URLSearchParams({
                start_date: startDate, end_date: endDate,
                messenger_id: messengerId, _t: Date.now(),
            });
            const res = await fetch(`${route('reports.global-stats.alerts')}?${params}`);
            setAlertData(await res.json());
        } catch {
            setAlertData(null);
        } finally {
            setAlertLoading(false);
        }
    }, [startDate, endDate, messengerId]);

    useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

    const [alertFilter, setAlertFilter] = useState('all');

    const fetchData = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({
            start_date: startDate,
            end_date: endDate,
            messenger_id: messengerId
        });
        try {
            const res = await fetch(`${route('reports.global-stats.data')}?${params}`);
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error('Error fetching global stats:', e);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, messengerId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const kpis = [
        { label: 'Mensajeros Activos', value: data?.summary?.active_messengers ?? 0, icon: '🛵', color: 'blue' },
        { label: 'Turnos Programados', value: data?.summary?.total_shifts ?? 0, icon: '📅', color: 'indigo' },
        { label: 'Reportes de Salida', value: data?.summary?.total_exits ?? 0, icon: '🏁', color: 'green' },
        { label: 'Reportes Preop.', value: data?.summary?.total_preop ?? 0, icon: '📋', color: 'orange' },
    ];

    const getCleaningTotal = (item, type) => {
        return data?.summary?.cleaning_summary?.find(c => c.item === item && c.type === type)?.total ?? 0;
    };

    return (
        <LeaderLayout title="Estadísticas Globales">
            <Head title="Estadísticas Globales" />

            <div className="max-w-[1800px] mx-auto p-3 sm:p-6 lg:p-8">
                {/* Header & Filters */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
                    <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                        Dashboard de Estadísticas Globales
                    </h1>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                        <div className="w-full sm:w-64">
                            <MessengerSearchSelect
                                messengers={messengers}
                                selectedId={messengerId}
                                onChange={setMessengerId}
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 pl-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Desde:</span>
                                <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                    className="border-none bg-transparent dark:text-white text-xs focus:ring-0 py-1 shadow-none" />
                            </div>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 pl-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Hasta:</span>
                                <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                    className="border-none bg-transparent dark:text-white text-xs focus:ring-0 py-1 shadow-none" />
                            </div>

                            <button
                                onClick={() => {
                                    const params = new URLSearchParams({
                                        start_date: startDate,
                                        end_date: endDate,
                                        messenger_id: messengerId
                                    });
                                    window.location.href = `${route('reports.global-stats.export')}?${params}`;
                                }}
                                className="flex items-center gap-2.5 bg-[#009164] hover:bg-[#007b55] text-white text-[11px] font-black uppercase tracking-widest px-7 py-3 rounded-full transition-all shadow-[0_4px_14px_0_rgba(0,145,100,0.39)] group"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                EXPORTAR
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {kpis.map((kpi, i) => (
                                <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center">
                                    <span className="text-3xl mb-3">{kpi.icon}</span>
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</span>
                                    <span className={`text-3xl font-black text-${kpi.color}-600 dark:text-${kpi.color}-400`}>{kpi.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Daily Activity Chart (Improved Grouped Bars) */}
                            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-8 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.4)]"></span>
                                    Actividad Operativa Diaria
                                </h3>

                                <div className="relative flex-1 min-h-[300px] flex flex-col overflow-hidden">
                                    {/* Y-Axis Lines (Fixed behind) */}
                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className="w-full border-t border-slate-100 dark:border-slate-700/50 flex justify-end">
                                                <span className="text-[8px] font-bold text-slate-300 dark:text-slate-600 -mt-1 mr-2">
                                                    {Math.round((data?.chart_data ? Math.max(...data.chart_data.map(x => Math.max(x.shifts, x.preoperational, x.cleaning, x.exits))) : 100) * (1 - i / 4))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Scrollable Bars Container */}
                                    <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
                                        <div className="flex items-end justify-start gap-1 px-2 h-full min-w-full" style={{ width: data?.chart_data?.length > 15 ? `${data.chart_data.length * 40}px` : '100%' }}>
                                            {data?.chart_data?.map((d, i) => {
                                                const globalMax = Math.max(...data.chart_data.map(x => Math.max(x.shifts, x.preoperational, x.cleaning, x.exits)), 1);
                                                return (
                                                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end pb-8 min-w-[30px]">
                                                        <div className="flex items-end gap-[1px] h-full w-full justify-center">
                                                            {/* Shift Bar */}
                                                            <div
                                                                style={{ height: `${(d.shifts / globalMax) * 100}%` }}
                                                                className="w-1 sm:w-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-t-[1px] shadow-sm transition-all duration-300 group-hover:brightness-110"
                                                            ></div>
                                                            {/* Preop Bar */}
                                                            <div
                                                                style={{ height: `${(d.preoperational / globalMax) * 100}%` }}
                                                                className="w-1 sm:w-1.5 bg-orange-500 dark:bg-orange-400 rounded-t-[1px] shadow-sm transition-all duration-300 group-hover:brightness-110"
                                                            ></div>
                                                            {/* Cleaning Bar */}
                                                            <div
                                                                style={{ height: `${(d.cleaning / globalMax) * 100}%` }}
                                                                className="w-1 sm:w-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-t-[1px] shadow-sm transition-all duration-300 group-hover:brightness-110"
                                                            ></div>
                                                            {/* Exit Bar */}
                                                            <div
                                                                style={{ height: `${(d.exits / globalMax) * 100}%` }}
                                                                className="w-1 sm:w-1.5 bg-rose-500 dark:bg-rose-400 rounded-t-[1px] shadow-sm transition-all duration-300 group-hover:brightness-110"
                                                            ></div>
                                                        </div>

                                                        <span className="absolute bottom-0 text-[8px] font-bold text-slate-400 mt-2 truncate max-w-full group-hover:text-slate-600 dark:group-hover:text-slate-200">
                                                            {d.date}
                                                        </span>

                                                        {/* Tooltip */}
                                                        <div className="absolute bottom-full mb-3 hidden group-hover:block bg-slate-900/95 backdrop-blur-sm text-white text-[10px] p-2.5 rounded-xl shadow-2xl z-20 border border-white/10 min-w-[100px] animate-in fade-in zoom-in duration-200">
                                                            <div className="font-black border-b border-white/10 pb-1.5 mb-1.5 text-center text-slate-400 uppercase tracking-widest">{d.date}</div>
                                                            <div className="flex justify-between items-center gap-4 mb-1">
                                                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span> Turnos:</span>
                                                                <span className="font-black text-indigo-300">{d.shifts}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center gap-4 mb-1">
                                                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span> Preops:</span>
                                                                <span className="font-black text-orange-300">{d.preoperational}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center gap-4 mb-1">
                                                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> Limpieza:</span>
                                                                <span className="font-black text-emerald-300">{d.cleaning}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center gap-4">
                                                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-rose-400 rounded-full"></span> Salidas:</span>
                                                                <span className="font-black text-rose-300">{d.exits}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-700/50 flex gap-6 justify-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-indigo-500 rounded-[3px]"></div>
                                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Turnos</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-orange-500 rounded-[3px]"></div>
                                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Preop</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-emerald-500 rounded-[3px]"></div>
                                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Aseo</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-rose-500 rounded-[3px]"></div>
                                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Salida</span>
                                    </div>
                                </div>
                            </div>


                            {/* Cleaning Breakdown */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Desglose de Aseo
                                </h3>

                                <div className="space-y-6">
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-lg">🛵</span>
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Motocicletas</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Semanal</span>
                                                <span className="text-xl font-black text-indigo-500">{getCleaningTotal('moto', 'semanal_superficial')}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mensual</span>
                                                <span className="text-xl font-black text-indigo-500">{getCleaningTotal('moto', 'mensual_profunda')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-lg">🎒</span>
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Maletas</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Semanal</span>
                                                <span className="text-xl font-black text-orange-500">{getCleaningTotal('maleta', 'semanal_superficial')}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mensual</span>
                                                <span className="text-xl font-black text-orange-500">{getCleaningTotal('maleta', 'mensual_profunda')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Sección de alertas de cumplimiento ── */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                            {/* Cabecera */}
                            <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                                    Alertas de Cumplimiento
                                </h3>
                                <span className="ml-1 text-[11px] text-slate-400 font-medium">
                                    — mismo período del filtro superior
                                </span>
                            </div>

                            {/* Filtros */}
                            {!alertLoading && !!alertData?.alerts?.length && (() => {
                                const rows = alertData.alerts;
                                const FILTERS = [
                                    { key: 'all',      label: 'Todos',         count: rows.length,                                   cls: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',         active: 'bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900' },
                                    { key: 'complete', label: '✓ Completos',   count: rows.filter(r => [r.preop,r.cleaning,r.lunch,r.exit].every(Boolean)).length, cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400', active: 'bg-emerald-500 text-white' },
                                    { key: 'preop',    label: '✗ Preop',       count: rows.filter(r => !r.preop).length,             cls: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',   active: 'bg-orange-500 text-white' },
                                    { key: 'cleaning', label: '✗ Aseo',        count: rows.filter(r => !r.cleaning).length,          cls: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',           active: 'bg-teal-500 text-white' },
                                    { key: 'lunch',    label: '✗ Almuerzo',    count: rows.filter(r => !r.lunch).length,             cls: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400',               active: 'bg-sky-500 text-white' },
                                    { key: 'exit',     label: '✗ Fin turno',   count: rows.filter(r => !r.exit).length,              cls: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',           active: 'bg-rose-500 text-white' },
                                ];
                                return (
                                    <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-700">
                                        {FILTERS.map(f => (
                                            <button
                                                key={f.key}
                                                onClick={() => setAlertFilter(f.key)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black transition-all ${alertFilter === f.key ? f.active : f.cls + ' hover:opacity-80'}`}
                                            >
                                                {f.label}
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${alertFilter === f.key ? 'bg-white/25' : 'bg-black/8 dark:bg-white/10'}`}>
                                                    {f.count}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                );
                            })()}

                            {/* Tabla */}
                            {alertLoading ? (
                                <div className="flex justify-center py-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
                                </div>
                            ) : !alertData?.alerts?.length ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                                    <span className="text-4xl mb-3">📭</span>
                                    <p className="text-sm font-bold">Sin turnos en el período seleccionado</p>
                                </div>
                            ) : (() => {
                                // Aplicar filtro seleccionado
                                const FILTER_FN = {
                                    all:      () => true,
                                    complete: r => [r.preop, r.cleaning, r.lunch, r.exit].every(Boolean),
                                    preop:    r => !r.preop,
                                    cleaning: r => !r.cleaning,
                                    lunch:    r => !r.lunch,
                                    exit:     r => !r.exit,
                                };
                                const rows = alertData.alerts.filter(FILTER_FN[alertFilter] ?? (() => true));
                                const dateGroups = [];
                                let lastDate = null;
                                rows.forEach(row => {
                                    if (row.date !== lastDate) {
                                        dateGroups.push({ date: row.date, rows: [] });
                                        lastDate = row.date;
                                    }
                                    dateGroups[dateGroups.length - 1].rows.push(row);
                                });

                                return (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-700/40 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                                    <th className="text-left px-4 py-3 w-28">Fecha</th>
                                                    <th className="text-left px-4 py-3">Mensajero</th>
                                                    <th className="text-center px-3 py-3"><span className="flex flex-col items-center gap-0.5"><span className="text-orange-500">📋</span>Preop</span></th>
                                                    <th className="text-center px-3 py-3"><span className="flex flex-col items-center gap-0.5"><span className="text-emerald-500">✨</span>Aseo</span></th>
                                                    <th className="text-center px-3 py-3"><span className="flex flex-col items-center gap-0.5"><span className="text-sky-500">🍽️</span>Almuerzo</span></th>
                                                    <th className="text-center px-3 py-3"><span className="flex flex-col items-center gap-0.5"><span className="text-rose-500">🏁</span>Fin turno</span></th>
                                                    <th className="text-center px-3 py-3">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dateGroups.map(({ date, rows: dayRows }) => (
                                                    <React.Fragment key={date}>
                                                        {dayRows.map((row, ri) => {
                                                            const done  = [row.preop, row.cleaning, row.lunch, row.exit].filter(Boolean).length;
                                                            const allOk = done === 4;
                                                            return (
                                                                <tr
                                                                    key={row.messenger_id}
                                                                    className={`border-t border-slate-50 dark:border-slate-700/50 transition-colors ${allOk ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/20'}`}
                                                                >
                                                                    {/* Fecha: solo en la primera fila del grupo */}
                                                                    {ri === 0 ? (
                                                                        <td rowSpan={dayRows.length} className="px-4 py-2 align-top border-t-2 border-slate-200 dark:border-slate-600">
                                                                            <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                                                {fmtDate(date)}
                                                                            </span>
                                                                        </td>
                                                                    ) : null}
                                                                    <td className="px-4 py-2 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">{row.messenger_name}</td>
                                                                    <td className="px-3 py-2 text-center"><CheckCell ok={row.preop} /></td>
                                                                    <td className="px-3 py-2 text-center"><CheckCell ok={row.cleaning} /></td>
                                                                    <td className="px-3 py-2 text-center"><CheckCell ok={row.lunch} /></td>
                                                                    <td className="px-3 py-2 text-center"><CheckCell ok={row.exit} /></td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black ${allOk ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : done === 0 ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}`}>
                                                                            {done}/4
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Resumen pie de tabla */}
                                        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-5 text-[11px] font-bold text-slate-400">
                                            {(() => {
                                                const total = rows.length;
                                                return [
                                                    { label: 'Preop',     val: rows.filter(r => r.preop).length,    color: 'text-orange-500' },
                                                    { label: 'Aseo',      val: rows.filter(r => r.cleaning).length, color: 'text-emerald-500' },
                                                    { label: 'Almuerzo',  val: rows.filter(r => r.lunch).length,    color: 'text-sky-500' },
                                                    { label: 'Fin turno', val: rows.filter(r => r.exit).length,     color: 'text-rose-500' },
                                                ].map(({ label, val, color }) => (
                                                    <span key={label}>
                                                        {label}: <span className={`${color} font-black`}>{val}</span>
                                                        <span className="text-slate-300 dark:text-slate-600">/{total}</span>
                                                    </span>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>
        </LeaderLayout>
    );
}
