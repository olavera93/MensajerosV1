import React, { useState, useEffect, useCallback } from 'react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import PrimaryButton from '@/Components/PrimaryButton';
import SuccessButton from '@/Components/SuccessButton';
import SecondaryButton from '@/Components/SecondaryButton';
import Modal from '@/Components/Modal';
import TextInput from '@/Components/TextInput';
import InputLabel from '@/Components/InputLabel';

export default function Exit({ messengers, filters }) {
    const [startDate, setStartDate] = useState(filters.start_date || new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(filters.end_date || new Date().toISOString().split('T')[0]);
    const [selectedMessenger, setSelectedMessenger] = useState(filters.messenger_id || '');
    const [messengerSearch, setMessengerSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [exitAnalysis, setExitAnalysis] = useState({ avg_diff: 0, history: [] });
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportDates, setExportDates] = useState({ start: startDate, end: endDate });
    const [syncing, setSyncing] = useState(false);
    const PAGE_SIZE = 10;

    const fetchData = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({
            start_date: startDate,
            end_date: endDate,
            messenger_id: selectedMessenger
        });
        try {
            const response = await fetch(`${route('reports.exit.data')}?${params}`);
            const data = await response.json();
            setExitAnalysis(data);
        } catch (error) {
            console.error('Error fetching exit analysis:', error);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, selectedMessenger]);

    useEffect(() => { fetchData(); setCurrentPage(1); }, [fetchData]);
    useEffect(() => { setCurrentPage(1); }, [messengerSearch]);

    const handleExport = (e) => {
        e.preventDefault();
        const params = new URLSearchParams({ start_date: exportDates.start, end_date: exportDates.end, messenger_id: selectedMessenger });
        window.location.href = `${route('reports.exit.export')}?${params}`;
        setShowExportModal(false);
    };

    const handleSync = async () => {
        if (!confirm(`¿Registrar el fin de turno desde DispatchTrack del ${startDate} al ${endDate}? Se reemplazarán los registros existentes de esas fechas.`)) return;
        setSyncing(true);
        try {
            const { data } = await axios.post(route('reports.exit.sync'), {
                start_date: startDate,
                end_date: endDate,
                messenger_id: selectedMessenger || null,
            });
            let message = `Sincronización completa: ${data.created} creados, ${data.updated} actualizados, ${data.unchanged} sin cambios.`;
            if (data.skipped.length) {
                message += `\n\nOmitidos:\n${data.skipped.slice(0, 15).join('\n')}${data.skipped.length > 15 ? `\n(y ${data.skipped.length - 15} más)` : ''}`;
            }
            alert(message);
            fetchData();
        } catch (error) {
            const errorData = error.response?.data;
            alert(errorData?.error || errorData?.message || 'Error sincronizando con DispatchTrack.');
        } finally {
            setSyncing(false);
        }
    };

    const diffLabel = (status) => {
        if (status === 'late') return 'Retraso';
        if (status === 'early') return 'Anticipado';
        return 'A Tiempo';
    };

    const diffColor = (status) => {
        if (status === 'late') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        if (status === 'early') return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (name) => {
        if (sortConfig.key !== name) return <span className="text-gray-300 dark:text-gray-600 ml-1">↕</span>;
        if (sortConfig.direction === 'asc') return <span className="text-indigo-500 ml-1">↑</span>;
        return <span className="text-indigo-500 ml-1">↓</span>;
    };

    return (
        <LeaderLayout title="Reporte de Salidas">
            <Head title="Reporte de Salidas" />

            <div className="max-w-[1800px] mx-auto p-3 sm:p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Reporte de Salidas</h1>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2">Desde:</span>
                            <TextInput
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="border-none bg-transparent dark:text-white text-xs focus:ring-0 py-1 shadow-none"
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2">Hasta:</span>
                            <TextInput
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="border-none bg-transparent dark:text-white text-xs focus:ring-0 py-1 shadow-none"
                            />
                        </div>
                        <div className="relative flex items-center gap-2 bg-white dark:bg-slate-800 p-1 pl-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <TextInput
                                type="text"
                                value={messengerSearch}
                                onChange={(e) => setMessengerSearch(e.target.value)}
                                placeholder="Buscar mensajero..."
                                className="border-none bg-transparent dark:text-white text-xs focus:ring-0 py-1 shadow-none w-44"
                            />
                            {messengerSearch && (
                                <button onClick={() => setMessengerSearch('')} className="pr-2 text-slate-400 hover:text-slate-600">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                        <PrimaryButton onClick={handleSync} disabled={syncing} className="flex items-center gap-2">
                            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {syncing ? 'SINCRONIZANDO...' : 'SINCRONIZAR DISPATCHTRACK'}
                        </PrimaryButton>
                        <SuccessButton onClick={() => { setExportDates({ start: startDate, end: endDate }); setShowExportModal(true); }} className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            EXPORTAR
                        </SuccessButton>
                    </div>
                </div>

                {!loading && exitAnalysis.avg_diff !== undefined && (
                    <div className="mb-4">
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-xl text-sm font-bold border border-indigo-200 dark:border-indigo-800">
                            Desviación Promedio: {Math.round(exitAnalysis.avg_diff)} min
                        </span>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                    </div>
                ) : (() => {
                    let filteredRows = exitAnalysis.history.filter(h => !messengerSearch || h.messenger.toLowerCase().includes(messengerSearch.toLowerCase()));

                    if (sortConfig.key) {
                        filteredRows.sort((a, b) => {
                            let aVal = a[sortConfig.key];
                            let bVal = b[sortConfig.key];

                            if (sortConfig.key === 'diff_minutes') {
                                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
                            } else {
                                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                                return 0;
                            }
                        });
                    }

                    const isSingleDay = startDate === endDate;
                    const effectivePageSize = isSingleDay ? Math.max(1, filteredRows.length) : PAGE_SIZE;
                    const totalPages = Math.max(1, Math.ceil(filteredRows.length / effectivePageSize));
                    const safePage = Math.min(currentPage, totalPages);
                    const paginatedRows = filteredRows.slice((safePage - 1) * effectivePageSize, safePage * effectivePageSize);

                    return (
                        <>
                            {/* ── Mobile Card List (< sm) ── */}
                            <div className="flex sm:hidden flex-col gap-3 mb-2">
                                {paginatedRows.length === 0 ? (
                                    <div className="text-center p-12 text-slate-400">
                                        <p className="text-3xl mb-2">🏁</p>
                                        <p className="text-sm font-medium">No hay registros para el período.</p>
                                    </div>
                                ) : paginatedRows.map((h, i) => (
                                    <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm px-4 py-3">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{h.messenger}</p>
                                            <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${diffColor(h.status)}`}>
                                                {Math.round(h.diff_minutes) > 0 ? `+${Math.round(h.diff_minutes)}` : Math.round(h.diff_minutes)} min · {diffLabel(h.status)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                            <span>📅 {h.date}</span>
                                            <span>⏱ {h.scheduled_end} → {h.actual_end}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ── Desktop Table (sm+) ── */}
                            <div className="hidden sm:block bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th onClick={() => requestSort('messenger')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                                    Mensajero {getSortIcon('messenger')}
                                                </th>
                                                <th onClick={() => requestSort('date')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                                    Fecha {getSortIcon('date')}
                                                </th>
                                                <th onClick={() => requestSort('scheduled_end')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                                    Programado {getSortIcon('scheduled_end')}
                                                </th>
                                                <th onClick={() => requestSort('actual_end')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                                    Reportado {getSortIcon('actual_end')}
                                                </th>
                                                <th onClick={() => requestSort('diff_minutes')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                                    Diferencia {getSortIcon('diff_minutes')}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {paginatedRows.map((h, i) => (
                                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{h.messenger}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{h.date}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{h.scheduled_end}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{h.actual_end}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <div className="flex flex-col gap-0.5 items-start w-fit">
                                                            <span className={`px-2 py-0.5 text-xs leading-5 font-semibold rounded-full w-fit ${diffColor(h.status)}`}>
                                                                {Math.round(h.diff_minutes) > 0 ? `+${Math.round(h.diff_minutes)}` : Math.round(h.diff_minutes)} min
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase">{diffLabel(h.status)}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {paginatedRows.length === 0 && (
                                                <tr>
                                                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                                                        No hay registros para el período seleccionado.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Pagination Bar */}
                            {totalPages > 1 && !isSingleDay && (
                                <div className="mt-6 flex items-center justify-between">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        Mostrando {(safePage - 1) * effectivePageSize + 1}–{Math.min(safePage * effectivePageSize, filteredRows.length)} de {filteredRows.length} registros
                                    </span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={safePage === 1}
                                            className="px-3 py-1.5 rounded border text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            ←
                                        </button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                                            .reduce((acc, p, idx, arr) => {
                                                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                                                acc.push(p);
                                                return acc;
                                            }, [])
                                            .map((p, i) => p === '...' ? (
                                                <span key={`ellipsis-${i}`} className="px-3 py-1.5 text-sm text-gray-400">…</span>
                                            ) : (
                                                <button
                                                    key={p}
                                                    onClick={() => setCurrentPage(p)}
                                                    className={`px-3 py-1.5 rounded border text-sm transition-colors ${p === safePage
                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                        : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                                                        }`}
                                                >
                                                    {p}
                                                </button>
                                            ))
                                        }
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={safePage === totalPages}
                                            className="px-3 py-1.5 rounded border text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>

            {/* Export Modal */}
            <Modal show={showExportModal} onClose={() => setShowExportModal(false)}>
                <div className="p-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                        📥 Exportar Reporte de Salidas
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        Selecciona el rango de fechas para generar el archivo Excel.
                    </p>
                    <form onSubmit={handleExport}>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <InputLabel value="Fecha Inicio" />
                                <TextInput type="date" required value={exportDates.start}
                                    onChange={(e) => setExportDates({ ...exportDates, start: e.target.value })} className="w-full" />
                            </div>
                            <div>
                                <InputLabel value="Fecha Fin" />
                                <TextInput type="date" required value={exportDates.end}
                                    onChange={(e) => setExportDates({ ...exportDates, end: e.target.value })} className="w-full" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <SecondaryButton onClick={() => setShowExportModal(false)}>Cancelar</SecondaryButton>
                            <SuccessButton type="submit" className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                EXPORTAR
                            </SuccessButton>
                        </div>
                    </form>
                </div>
            </Modal>
        </LeaderLayout>
    );
}
