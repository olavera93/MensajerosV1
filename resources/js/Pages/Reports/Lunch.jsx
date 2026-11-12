import React, { useState, useEffect, useCallback } from 'react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import { Head } from '@inertiajs/react';
import SuccessButton from '@/Components/SuccessButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import useCan from '@/hooks/useCan';

export default function LunchReport({ filters }) {
    const can = useCan();
    const [startDate, setStartDate] = useState(filters?.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(filters?.end_date || new Date().toISOString().split('T')[0]);
    const [messengerSearch, setMessengerSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'start_time', direction: 'desc' });
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportDates, setExportDates] = useState({ start: '', end: '' });
    const PAGE_SIZE = 10;

    const fetchData = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
        try {
            const res = await fetch(`${route('reports.lunch.data')}?${params}`);
            const data = await res.json();
            setLogs(data.logs || []);
        } catch (e) {
            console.error('Error fetching lunch data:', e);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => { fetchData(); setCurrentPage(1); }, [fetchData]);
    useEffect(() => { setCurrentPage(1); }, [messengerSearch]);

    const handleExport = (e) => {
        e.preventDefault();
        if (!exportDates.start || !exportDates.end) { alert('Por favor selecciona ambas fechas.'); return; }
        const params = new URLSearchParams({ start_date: exportDates.start, end_date: exportDates.end }).toString();
        window.location.href = route('reports.lunch.export') + '?' + params;
        setShowExportModal(false);
    };

    let filteredRows = logs.filter(l => !messengerSearch || l.messenger.toLowerCase().includes(messengerSearch.toLowerCase()));

    if (sortConfig.key) {
        filteredRows.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    const isSingleDay = startDate === endDate;
    const effectivePageSize = isSingleDay ? Math.max(1, filteredRows.length) : PAGE_SIZE;

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / effectivePageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedRows = filteredRows.slice((safePage - 1) * effectivePageSize, safePage * effectivePageSize);

    const statusBadge = (status) => status === 'active'
        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';

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
        <LeaderLayout title="Reporte de Almuerzos">
            <Head title="Reporte Almuerzos" />

            <div className="max-w-[1800px] mx-auto p-3 sm:p-6 lg:p-8">
                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Reporte de Almuerzos</h1>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        {/* Desde */}
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 pl-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Desde:</span>
                            <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                className="border-none bg-transparent dark:text-white text-xs focus:ring-0 py-1 shadow-none" />
                        </div>
                        {/* Hasta */}
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 pl-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Hasta:</span>
                            <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                className="border-none bg-transparent dark:text-white text-xs focus:ring-0 py-1 shadow-none" />
                        </div>
                        {/* Search */}
                        <div className="relative flex items-center gap-2 bg-white dark:bg-slate-800 p-1 pl-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <TextInput type="text" value={messengerSearch} onChange={(e) => setMessengerSearch(e.target.value)}
                                placeholder="Buscar mensajero..."
                                className="border-none bg-transparent dark:text-white text-xs focus:ring-0 py-1 shadow-none w-44" />
                            {messengerSearch && (
                                <button onClick={() => setMessengerSearch('')} className="pr-2 text-slate-400 hover:text-slate-600">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                        {/* Export */}
                        {can('almuerzo.exportar') && (
                            <SuccessButton onClick={() => { setExportDates({ start: startDate, end: endDate }); setShowExportModal(true); }} className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                EXPORTAR
                            </SuccessButton>
                        )}
                    </div>
                </div>

                {/* Table / Cards */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                    </div>
                ) : (
                    <>
                        {/* ── Mobile Card List (< sm) ── */}
                        <div className="flex sm:hidden flex-col gap-3 mb-2">
                            {paginatedRows.length === 0 ? (
                                <div className="text-center p-12 text-slate-400">
                                    <p className="text-3xl mb-2">🍽️</p>
                                    <p className="text-sm font-medium">No hay registros de almuerzo.</p>
                                </div>
                            ) : paginatedRows.map((log) => (
                                <div key={log.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm px-4 py-3 flex items-center gap-3">
                                    <div className="shrink-0 w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center">
                                        <span className="text-white text-sm font-black">{log.messenger.slice(0, 2).toUpperCase()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{log.messenger}</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{log.date} &nbsp;·&nbsp; {log.start_time} → {log.end_time}</p>
                                    </div>
                                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${statusBadge(log.status)}`}>
                                        {log.status === 'active' ? 'Activo' : 'Completado'}
                                    </span>
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
                                            <th onClick={() => requestSort('start_time')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                                Inicio {getSortIcon('start_time')}
                                            </th>
                                            <th onClick={() => requestSort('end_time')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                                Fin (Estimado) {getSortIcon('end_time')}
                                            </th>
                                            <th onClick={() => requestSort('status')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                                Estado {getSortIcon('status')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {paginatedRows.map((log) => (
                                            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{log.messenger}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{log.date}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{log.start_time}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{log.end_time}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full w-fit ${statusBadge(log.status)}`}>
                                                        {log.status === 'active' ? 'Activo' : 'Completado'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {paginatedRows.length === 0 && (
                                            <tr><td colSpan="5" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No hay registros de almuerzo.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && !isSingleDay && (
                            <div className="mt-6 flex items-center justify-between">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Mostrando {(safePage - 1) * effectivePageSize + 1}–{Math.min(safePage * effectivePageSize, filteredRows.length)} de {filteredRows.length} registros
                                </span>
                                <div className="flex gap-1">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                                        className="px-3 py-1.5 rounded border text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">←</button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                                        .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...'); acc.push(p); return acc; }, [])
                                        .map((p, i) => p === '...' ? (
                                            <span key={`e-${i}`} className="px-3 py-1.5 text-sm text-gray-400">…</span>
                                        ) : (
                                            <button key={p} onClick={() => setCurrentPage(p)}
                                                className={`px-3 py-1.5 rounded border text-sm transition-colors ${p === safePage ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                                                {p}
                                            </button>
                                        ))}
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                        className="px-3 py-1.5 rounded border text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">→</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Export Modal */}
            <Modal show={showExportModal} onClose={() => setShowExportModal(false)}>
                <div className="p-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">📥 Exportar Reporte de Almuerzos</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Selecciona el rango de fechas para generar el archivo Excel.</p>
                    <form onSubmit={handleExport}>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <InputLabel value="Fecha Inicio" />
                                <TextInput type="date" required value={exportDates.start} onChange={(e) => setExportDates({ ...exportDates, start: e.target.value })} className="w-full" />
                            </div>
                            <div>
                                <InputLabel value="Fecha Fin" />
                                <TextInput type="date" required value={exportDates.end} onChange={(e) => setExportDates({ ...exportDates, end: e.target.value })} className="w-full" />
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
