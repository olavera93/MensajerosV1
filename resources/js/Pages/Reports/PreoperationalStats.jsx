import React, { useState, useEffect, useRef } from 'react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';

export default function PreoperationalStats({ auth, filters, messengers }) {
    const [startDate, setStartDate] = useState(filters.start_date || '');
    const [endDate, setEndDate] = useState(filters.end_date || '');
    const [messengerId, setMessengerId] = useState(filters.messenger_id || '');
    const [searchName, setSearchName] = useState(() => {
        if (filters.messenger_id && messengers) {
            const m = messengers.find(m => m.id == filters.messenger_id);
            return m ? m.name : '';
        }
        return '';
    });
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);

    const wrapperRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    useEffect(() => {
        fetchStats();
    }, [startDate, endDate, messengerId]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await axios.get(route('reports.preoperational.stats.data'), {
                params: { start_date: startDate, end_date: endDate, messenger_id: messengerId }
            });
            setStats(res.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = (e) => {
        e.preventDefault();
        fetchStats();
        // Update URL
        router.get(
            route('reports.preoperational.stats'),
            { start_date: startDate, end_date: endDate, messenger_id: messengerId },
            { preserveState: true, replace: true }
        );
    };

    return (
        <LeaderLayout
            user={auth.user}
            header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">Dashboard Preoperacional</h2>}
        >
            <Head title="Estadísticas Preoperacionales" />

            <div className="py-8">
                <div className="max-w-[1800px] mx-auto sm:px-6 lg:px-8">

                    {/* Header y Filtros */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <Link
                                href={route('reports.preoperational')}
                                className="text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 font-medium text-sm flex items-center gap-2"
                            >
                                <span>←</span> Volver a la Tabla
                            </Link>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Análisis de Novedades</h3>
                        </div>

                        <form onSubmit={handleFilter} className="grid grid-cols-2 sm:flex gap-2 w-full md:w-auto items-center">
                            <div ref={wrapperRef} className="relative col-span-2 flex items-center w-full sm:w-64 z-50">
                                <input
                                    type="text"
                                    placeholder="Buscar mensajero..."
                                    value={searchName}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setSearchName(val);
                                        setShowSuggestions(true);
                                        if (val === '') {
                                            setMessengerId('');
                                        } else {
                                            const found = messengers?.find(m => m.name.toLowerCase() === val.toLowerCase());
                                            if (found) {
                                                setMessengerId(found.id);
                                            }
                                        }
                                    }}
                                    onClick={() => setShowSuggestions(true)}
                                    onFocus={() => setShowSuggestions(true)}
                                    // Removed onBlur completely and handling outside clicks via the wrapperRef
                                    className="border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 focus:border-indigo-500 dark:focus:border-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-600 rounded-md shadow-sm text-sm w-full pr-8"
                                />

                                {showSuggestions && (
                                    <div className="absolute top-10 w-full left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        {messengers?.filter(m => m.name.toLowerCase().includes((searchName || '').toLowerCase())).map(m => (
                                            <div
                                                key={m.id}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setSearchName(m.name);
                                                    setMessengerId(m.id);
                                                    setShowSuggestions(false);
                                                }}
                                                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer"
                                            >
                                                {m.name}
                                            </div>
                                        ))}
                                        {messengers?.filter(m => m.name.toLowerCase().includes((searchName || '').toLowerCase())).length === 0 && (
                                            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                                No se encontraron resultados.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {searchName && (
                                    <button
                                        type="button"
                                        onClick={() => { setSearchName(''); setMessengerId(''); fetchStats(); }}
                                        className="absolute right-2 text-gray-400 hover:text-gray-600"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full min-w-0 sm:w-auto border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 focus:border-indigo-500 dark:focus:border-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-600 rounded-md shadow-sm text-sm"
                            />
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full min-w-0 sm:w-auto border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 focus:border-indigo-500 dark:focus:border-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-600 rounded-md shadow-sm text-sm"
                            />
                            <button
                                type="submit"
                                className="col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors text-sm font-medium"
                            >
                                Filtrar
                            </button>
                        </form>
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                        </div>
                    ) : stats && stats.metrics ? (
                        <div className="space-y-6">

                            {/* KPM Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center text-center">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Turnos Realizados</p>
                                    <h4 className="text-4xl font-black text-gray-900 dark:text-white">{stats.metrics.worked_days}</h4>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center text-center">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Reportes</p>
                                    <div className="flex flex-col items-center">
                                        <h4 className="text-4xl font-black text-gray-900 dark:text-white">{stats.metrics.total_inspections}</h4>
                                        <span className="text-xs text-gray-400 font-bold mt-1">({stats.metrics.on_time_count} a tiempo)</span>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-indigo-100 dark:border-indigo-900/30 flex flex-col items-center justify-center text-center bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-gray-800">
                                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Cumplimiento a Tiempo</p>
                                    <div className="flex items-baseline gap-1">
                                        <h4 className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{stats.metrics.on_time_percentage}</h4>
                                        <span className="text-xl font-bold text-indigo-400">%</span>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-green-100 dark:border-green-900/30 flex flex-col items-center justify-center text-center">
                                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-1">Sin Novedad</p>
                                    <h4 className="text-4xl font-black text-emerald-600 dark:text-emerald-400">{stats.metrics.total_flawless}</h4>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-red-100 dark:border-red-900/30 flex flex-col items-center justify-center text-center">
                                    <p className="text-xs font-medium text-rose-500 dark:text-rose-400 uppercase tracking-widest mb-1">Con Novedades</p>
                                    <h4 className="text-4xl font-black text-rose-500 dark:text-rose-400">{stats.metrics.total_with_issues}</h4>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Top Issues By Key */}
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                                        <span>⚠️</span> Novedades Frecuentes
                                    </h4>

                                    {Object.keys(stats.issues_by_key).length === 0 ? (
                                        <div className="text-center text-gray-500 dark:text-gray-400 py-10">
                                            No se reportaron novedades en este periodo.
                                        </div>
                                    ) : (
                                        <div className="space-y-5">
                                            {Object.entries(stats.issues_by_key).map(([label, count]) => {
                                                const percentage = Math.min(100, Math.round((count / stats.metrics.total_inspections) * 100));
                                                return (
                                                    <div key={label}>
                                                        <div className="flex justify-between text-sm mb-1 font-medium">
                                                            <span className="text-gray-700 dark:text-gray-300">{label}</span>
                                                            <span className="text-rose-500 font-bold">{count} incidentes</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                                            <div className="bg-rose-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Issues By Category */}
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                                        <span>📊</span> Novedades por Categoría
                                    </h4>

                                    {Object.keys(stats.issues_by_category).length === 0 ? (
                                        <div className="text-center text-gray-500 dark:text-gray-400 py-10">
                                            No hay datos para mostrar.
                                        </div>
                                    ) : (
                                        <div className="space-y-5">
                                            {Object.entries(stats.issues_by_category).map(([category, count]) => {
                                                // Consider totals
                                                const totalIssues = Object.values(stats.issues_by_category).reduce((a, b) => a + b, 0);
                                                const percentage = Math.round((count / totalIssues) * 100);
                                                return (
                                                    <div key={category}>
                                                        <div className="flex justify-between text-sm mb-1 font-medium">
                                                            <span className="text-gray-700 dark:text-gray-300">{category}</span>
                                                            <span className="text-amber-500 font-bold">{count} reportes ({percentage}%)</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                                            <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm text-gray-500 dark:text-gray-400">
                            No se encontraron datos para mostrar en este rango de fechas.
                        </div>
                    )}
                </div>
            </div>
        </LeaderLayout>
    );
}
