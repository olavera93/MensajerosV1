import React, { useState, useEffect, useCallback } from 'react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import { Head, usePage, Link } from '@inertiajs/react';
import SuccessButton from '@/Components/SuccessButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import useCan from '@/hooks/useCan';

export default function PreoperationalReport({ filters }) {
    const can = useCan();
    const [startDate, setStartDate] = useState(filters?.start_date || new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(filters?.end_date || new Date().toISOString().split('T')[0]);
    const [messengerSearch, setMessengerSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportDates, setExportDates] = useState({ start: '', end: '' });
    const [selectedAnswersModal, setSelectedAnswersModal] = useState(null);
    const PAGE_SIZE = 15;

    const fetchData = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
        try {
            const res = await fetch(`${route('reports.preoperational.data')}?${params}`);
            const data = await res.json();
            setLogs(data.logs || []);
        } catch (e) {
            console.error('Error fetching preoperational data:', e);
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
        window.location.href = route('reports.preoperational.export') + '?' + params;
        setShowExportModal(false);
    };

    let filteredRows = logs.filter(l => !messengerSearch || l.messenger.toLowerCase().includes(messengerSearch.toLowerCase()));

    if (sortConfig.key) {
        filteredRows.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            if (sortConfig.key === 'date') {
                // Combine date and time to sort properly
                aVal = new Date(a.date.split('/').reverse().join('-') + 'T' + a.time);
                bVal = new Date(b.date.split('/').reverse().join('-') + 'T' + b.time);
            }

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
        <LeaderLayout title="Reporte Preoperacionales">
            <Head title="Reporte Preoperacional" />

            <div className="max-w-[1800px] mx-auto p-3 sm:p-6 lg:p-8">
                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Reporte de Inspección Preoperacional</h1>

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
                        {/* Stats Link */}
                        <Link
                            href={route('reports.preoperational.stats')}
                            data={{ start_date: startDate, end_date: endDate }}
                            className="inline-flex items-center px-4 py-2 bg-indigo-600 dark:bg-indigo-500 border border-transparent rounded-md font-semibold text-xs text-white uppercase tracking-widest hover:bg-indigo-700 dark:hover:bg-indigo-400 focus:bg-indigo-700 dark:focus:bg-indigo-400 active:bg-indigo-900 dark:active:bg-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition ease-in-out duration-150 gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            ESTADÍSTICAS
                        </Link>
                        {/* Configurar Preguntas */}
                        {can('preoperacional.preguntas') && (
                            <Link
                                href={route('reports.preoperational.questions')}
                                className="inline-flex items-center px-4 py-2 bg-slate-600 dark:bg-slate-500 border border-transparent rounded-md font-semibold text-xs text-white uppercase tracking-widest hover:bg-slate-700 dark:hover:bg-slate-400 focus:bg-slate-700 dark:focus:bg-slate-400 active:bg-slate-900 dark:active:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition ease-in-out duration-150 gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                CONFIG Preguntas
                            </Link>
                        )}
                        {/* Export */}
                        {can('preoperacional.exportar') && (
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
                        {/* Desktop Table (sm+) */}
                        <div className="hidden sm:block bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th onClick={() => requestSort('messenger')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                                Mensajero {getSortIcon('messenger')}
                                            </th>
                                            <th onClick={() => requestSort('vehicle')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                                Vehículo {getSortIcon('vehicle')}
                                            </th>
                                            <th onClick={() => requestSort('date')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                                Fecha y Hora {getSortIcon('date')}
                                            </th>
                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                ¿A Tiempo?
                                            </th>
                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                SÍ | NO
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Observaciones
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Detalle
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {paginatedRows.map((log) => (
                                            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{log.messenger}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{log.vehicle}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{log.date} {log.time}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.on_time === 'A Tiempo' ? 'bg-green-100 text-green-800' : log.on_time === 'Sin Turno' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'}`}>
                                                        {log.on_time}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-600 dark:text-gray-300">
                                                    <span className="text-green-600 dark:text-green-400">{log.yes_count}</span>
                                                    <span className="mx-1">|</span>
                                                    <span className="text-red-500 dark:text-red-400">{log.no_count}</span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">{log.observations || <span className="italic text-gray-400">Sin observaciones</span>}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => setSelectedAnswersModal(log)}
                                                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1.5 rounded-md font-bold text-xs"
                                                    >
                                                        Ver Checklist
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {paginatedRows.length === 0 && (
                                            <tr><td colSpan="7" className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">No hay registros para las fechas seleccionadas.</td></tr>
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

            {/* Checklist Modal */}
            <Modal show={!!selectedAnswersModal} onClose={() => setSelectedAnswersModal(null)} maxWidth="md">
                {selectedAnswersModal && (
                    <div className="p-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Checklist de Inspección</h2>
                        <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 mb-6 pb-4 border-b dark:border-gray-700">
                            <span>{selectedAnswersModal.messenger}</span>
                            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">{selectedAnswersModal.vehicle}</span>
                        </div>

                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                            {selectedAnswersModal.answers && Object.keys(selectedAnswersModal.answers).length > 0 ? (
                                Object.entries(selectedAnswersModal.answers).map(([key, value]) => (
                                    <div key={key} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{key.replace(/_/g, ' ')}</span>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${value === 'bueno' || value === true || value === 'si'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                                            : value === 'malo' || value === false || value === 'no'
                                                ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400'
                                            }`}>
                                            {typeof value === 'boolean' ? (value ? 'SÍ' : 'NO') : String(value).toUpperCase()}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-500 text-sm">No hay respuestas registradas.</p>
                            )}

                            {selectedAnswersModal.observations && (
                                <div className="mt-6 pt-4 border-t dark:border-gray-700">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Observaciones reportadas</h4>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-100 dark:border-orange-800">
                                        {selectedAnswersModal.observations}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <SecondaryButton onClick={() => setSelectedAnswersModal(null)}>Cerrar</SecondaryButton>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Export Modal */}
            <Modal show={showExportModal} onClose={() => setShowExportModal(false)}>
                <div className="p-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">📥 Exportar Inspecciones</h2>
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
