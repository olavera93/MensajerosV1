import React, { useState } from 'react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import { Head, Link, useForm, router, usePage } from '@inertiajs/react'; // Correct router import from adapter
import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import PrimaryButton from '@/Components/PrimaryButton';
import SuccessButton from '@/Components/SuccessButton';
import TextInput from '@/Components/TextInput';
import InputLabel from '@/Components/InputLabel';
import ShiftModal from '@/Components/ShiftModal';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.locale('es');
dayjs.extend(isBetween);

export default function ShiftsIndex({ auth, messengers, weekStart, weekEnd }) {
    const { errors } = usePage().props;
    const [selectedShift, setSelectedShift] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalDate, setModalDate] = useState(null);
    const [modalMessenger, setModalMessenger] = useState(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportDates, setExportDates] = useState({ start: '', end: '' });
    const [messengerSearch, setMessengerSearch] = useState('');
    const [shiftLocationFilter, setShiftLocationFilter] = useState('');  // '' | 'principal' | 'teusaquillo'
    const [shiftStatusFilter, setShiftStatusFilter] = useState('');      // '' | 'present' | 'absent' | 'none'
    const [sortOrder, setSortOrder] = useState('');                      // '' | 'asc' | 'desc'
    const [dayFilter, setDayFilter] = useState('');                      // '' | 'YYYY-MM-DD'

    const activeFilterCount = [messengerSearch, shiftLocationFilter, shiftStatusFilter, sortOrder, dayFilter].filter(Boolean).length;

    const clearFilters = () => {
        setMessengerSearch('');
        setShiftLocationFilter('');
        setShiftStatusFilter('');
        setSortOrder('');
        setDayFilter('');
    };

    // Per-day shift filter helper (shared by both views)
    const matchesShiftFilters = (m, dateStr) => {
        const shift = m.shifts.find(s => s.date === dateStr);
        if (shiftLocationFilter && (!shift || shift.status === 'absent' || shift.location !== shiftLocationFilter)) return false;
        if (shiftStatusFilter === 'none' && shift) return false;
        if (shiftStatusFilter === 'present' && (!shift || shift.status !== 'present')) return false;
        if (shiftStatusFilter === 'absent' && (!shift || shift.status !== 'absent')) return false;
        return true;
    };

    // Helper: get the representative start_time for sorting (day-specific or earliest of the week)
    const getSortTime = (m) => {
        const relevantShifts = dayFilter
            ? m.shifts.filter(s => s.date === dayFilter && s.status === 'present' && s.start_time)
            : m.shifts.filter(s => s.status === 'present' && s.start_time);
        if (!relevantShifts.length) return sortOrder === 'asc' ? '99:99' : '00:00';
        const times = relevantShifts.map(s => s.start_time.substring(0, 5));
        return sortOrder === 'asc' ? times.sort()[0] : times.sort().reverse()[0];
    };

    // Filter for desktop weekly view
    // When a day is selected → apply shift filters to that day only
    // When no day selected  → show messenger if ANY day of the week satisfies the shift filters
    const filteredMessengers = messengers.filter(m => {
        if (messengerSearch && !m.name.toLowerCase().includes(messengerSearch.toLowerCase())) return false;
        if (dayFilter) return matchesShiftFilters(m, dayFilter);
        if (shiftLocationFilter && !m.shifts.some(s => s.status !== 'absent' && s.location === shiftLocationFilter)) return false;
        if (shiftStatusFilter === 'none' && m.shifts.length > 0) return false;
        if (shiftStatusFilter === 'present' && !m.shifts.some(s => s.status === 'present')) return false;
        if (shiftStatusFilter === 'absent' && !m.shifts.some(s => s.status === 'absent')) return false;
        return true;
    });

    const sortedFilteredMessengers = sortOrder
        ? [...filteredMessengers].sort((a, b) => {
            const ta = getSortTime(a);
            const tb = getSortTime(b);
            return sortOrder === 'asc' ? ta.localeCompare(tb) : tb.localeCompare(ta);
        })
        : filteredMessengers;

    // Filter for mobile daily view
    const filteredMessengersForDay = (dateStr) => messengers.filter(m => {
        if (messengerSearch && !m.name.toLowerCase().includes(messengerSearch.toLowerCase())) return false;
        return matchesShiftFilters(m, dateStr);
    });

    // Mobile: which day column is active (0 = Mon … 6 = Sun)
    const [selectedDayIdx, setSelectedDayIdx] = useState(() => {
        const todayDow = new Date().getDay(); // 0=Sun
        const weekStartDow = new Date(weekStart).getDay();
        const diff = (todayDow - weekStartDow + 7) % 7;
        return diff < 7 ? diff : 0;
    });

    const { data, setData, post, delete: destroy, reset } = useForm({});

    const start = dayjs(weekStart);
    const days = Array.from({ length: 7 }, (_, i) => start.add(i, 'day'));

    const handleCellClick = (messenger, dateString, shift) => {
        setModalMessenger(messenger);
        setModalDate(dateString);
        setSelectedShift(shift);
        setIsModalOpen(true);
    };

    const handleSave = (formData) => {
        router.post('/shifts', {
            ...formData,
            messenger_id: modalMessenger.id,
            date: modalDate,
        }, {
            onSuccess: () => setIsModalOpen(false),
        });
    };

    const handleDelete = (id) => {
        if (confirm('¿Estás seguro de eliminar este turno?')) {
            router.delete(`/shifts/${id}`, {
                onSuccess: () => setIsModalOpen(false),
            });
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        router.post(route('shifts.import'), formData, {
            forceFormData: true,
            onSuccess: () => {
                alert('Horarios importados correctamente');
                e.target.value = ''; // Reset input
            },
            onError: (errors) => {
                alert(errors.file || 'Error al importar');
            }
        });
    };

    const handleExport = () => {
        if (!exportDates.start || !exportDates.end) {
            alert('Selecciona ambas fechas');
            return;
        }
        const url = route('shifts.export', { start_date: exportDates.start, end_date: exportDates.end });
        window.location.href = url;
        setShowExportModal(false);
    };

    return (
        <LeaderLayout
            user={auth.user}
            header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">Gestión de Horarios</h2>}
        >
            <Head title="Horarios" />

            <div className="py-6 sm:py-12">
                <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8">
                    {/* Navigation */}
                    <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center mb-8 gap-6">
                        <div className="flex flex-col sm:flex-row items-stretch gap-3">
                            <a
                                href={route('shifts.template')}
                                className="inline-flex items-center justify-center px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-[10px] text-slate-600 dark:text-slate-300 uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all font-sans"
                            >
                                📄 Plantilla
                            </a>
                            <label className="inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 border border-transparent rounded-xl font-bold text-[10px] text-white uppercase tracking-widest hover:bg-indigo-500 shadow-lg shadow-indigo-200 dark:shadow-none transition-all cursor-pointer">
                                📤 Cargar Turnos
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".xlsx, .xls"
                                    onChange={handleFileUpload}
                                />
                            </label>

                            <SuccessButton
                                onClick={() => setShowExportModal(true)}
                                className="justify-center"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                EXPORTAR
                            </SuccessButton>
                        </div>

                        {/* Filters panel */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Name search */}
                            <div className="relative flex items-center gap-2 bg-white dark:bg-slate-800 p-1 pl-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <TextInput
                                    type="text"
                                    value={messengerSearch}
                                    onChange={(e) => setMessengerSearch(e.target.value)}
                                    placeholder="Buscar mensajero..."
                                    className="border-none bg-transparent dark:text-white text-xs focus:ring-0 py-1 shadow-none w-36"
                                />
                                {messengerSearch && (
                                    <button onClick={() => setMessengerSearch('')} className="pr-2 text-slate-400 hover:text-slate-600">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>

                            {/* Day filter */}
                            <select
                                value={dayFilter}
                                onChange={e => {
                                    setDayFilter(e.target.value);
                                    if (e.target.value) {
                                        const idx = days.findIndex(d => d.format('YYYY-MM-DD') === e.target.value);
                                        if (idx !== -1) setSelectedDayIdx(idx);
                                    }
                                }}
                                className={`text-[11px] font-bold py-2 pl-3 pr-7 rounded-xl border shadow-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:ring-indigo-500 focus:border-indigo-400 transition-colors ${dayFilter ? 'border-indigo-400 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                            >
                                <option value="">Todos los días</option>
                                {days.map(d => (
                                    <option key={d.format('YYYY-MM-DD')} value={d.format('YYYY-MM-DD')}>
                                        {d.format('dddd D MMM')}
                                    </option>
                                ))}
                            </select>

                            {/* Sede del turno */}
                            <select
                                value={shiftLocationFilter}
                                onChange={e => setShiftLocationFilter(e.target.value)}
                                className={`text-[11px] font-bold py-2 pl-3 pr-7 rounded-xl border shadow-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:ring-indigo-500 focus:border-indigo-400 transition-colors ${shiftLocationFilter ? 'border-indigo-400 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                            >
                                <option value="">Sede del turno</option>
                                <option value="principal">Principal (116)</option>
                                <option value="teusaquillo">Teusaquillo</option>
                            </select>

                            {/* Estado */}
                            <select
                                value={shiftStatusFilter}
                                onChange={e => setShiftStatusFilter(e.target.value)}
                                className={`text-[11px] font-bold py-2 pl-3 pr-7 rounded-xl border shadow-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:ring-indigo-500 focus:border-indigo-400 transition-colors ${shiftStatusFilter ? 'border-indigo-400 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                            >
                                <option value="">Estado</option>
                                <option value="present">Presente</option>
                                <option value="absent">Ausente</option>
                                <option value="none">Sin turno</option>
                            </select>

                            {/* Ordenar por hora */}
                            <select
                                value={sortOrder}
                                onChange={e => setSortOrder(e.target.value)}
                                className={`text-[11px] font-bold py-2 pl-3 pr-7 rounded-xl border shadow-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:ring-indigo-500 focus:border-indigo-400 transition-colors ${sortOrder ? 'border-indigo-400 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                            >
                                <option value="">Ordenar por hora</option>
                                <option value="asc">⬆ Temprano → Tarde</option>
                                <option value="desc">⬇ Tarde → Temprano</option>
                            </select>

                            {/* Clear all */}
                            {activeFilterCount > 0 && (
                                <button
                                    onClick={clearFilters}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 text-[11px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                                >
                                    <span className="bg-indigo-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black">{activeFilterCount}</span>
                                    Limpiar
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between sm:justify-center gap-4 bg-slate-100 dark:bg-slate-900/50 p-2 rounded-2xl">
                            <Link
                                href={`/shifts?date=${start.subtract(1, 'week').format('YYYY-MM-DD')}`}
                                className="p-2 sm:px-4 bg-white dark:bg-slate-800 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
                            >
                                <span className="font-black text-indigo-600">←</span>
                            </Link>
                            <span className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight text-center px-2">
                                {start.format('D MMM')} - {dayjs(weekEnd).format('D MMM')}
                            </span>
                            <Link
                                href={`/shifts?date=${start.add(1, 'week').format('YYYY-MM-DD')}`}
                                className="p-2 sm:px-4 bg-white dark:bg-slate-800 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
                            >
                                <span className="font-black text-indigo-600">→</span>
                            </Link>
                        </div>
                    </div>

                    {/* ── Mobile: Day Picker + Vertical List (< sm) ── */}
                    <div className="sm:hidden">
                        {/* Day chip selector */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-3 px-1">
                            {days.map((d, idx) => {
                                const isToday = d.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD');
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedDayIdx(idx)}
                                        className={`shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95
                                            ${selectedDayIdx === idx
                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}
                                    >
                                        <span className="uppercase text-[9px] tracking-wider">{d.format('ddd')}</span>
                                        <span className={`text-base leading-none font-black ${isToday && selectedDayIdx !== idx ? 'text-indigo-500 dark:text-indigo-400' : ''}`}>{d.format('D')}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Messenger list for selected day */}
                        <div className="flex flex-col gap-2">
                            {(() => {
                                const selectedDay = days[selectedDayIdx];
                                const dateStr = selectedDay.format('YYYY-MM-DD');
                                const filteredMs = filteredMessengersForDay(dateStr);

                                return filteredMs.length === 0 ? (
                                    <div className="text-center p-12 text-slate-400">
                                        <p className="text-sm font-medium">Sin mensajeros</p>
                                    </div>
                                ) : filteredMs.map(messenger => {
                                    const shift = messenger.shifts.find(s => s.date === dateStr);
                                    const isAbsent = shift?.status === 'absent';
                                    const isTeusa = shift?.location === 'teusaquillo';

                                    return (
                                        <button
                                            key={messenger.id}
                                            onClick={() => handleCellClick(messenger, dateStr, shift)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all active:scale-[0.98]
                                                ${isAbsent
                                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                                    : isTeusa
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                                        : shift
                                                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}
                                        >
                                            {/* Avatar */}
                                            <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                                                ${isAbsent ? 'bg-red-400' : isTeusa ? 'bg-emerald-500' : shift ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                                <span className="text-white text-xs font-black">
                                                    {messenger.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                                                </span>
                                            </div>
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{messenger.name}</p>
                                                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{messenger.vehicle}</p>
                                            </div>
                                            {/* Shift info */}
                                            <div className="shrink-0 text-right">
                                                {isAbsent ? (
                                                    <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase">No Asiste</span>
                                                ) : shift ? (
                                                    <div className="flex flex-col items-end font-mono text-[11px] font-bold">
                                                        <span className={isTeusa ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'}>{shift.start_time?.substring(0, 5)}</span>
                                                        <span className="text-slate-300 dark:text-slate-600 text-[9px]">↓</span>
                                                        <span className={isTeusa ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'}>{shift.end_time?.substring(0, 5)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xl text-slate-300 dark:text-slate-600">+</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                });
                            })()}
                        </div>
                    </div>

                    {/* ── Desktop: Full Weekly Table (sm+) ── */}
                    <div className="hidden sm:block bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg overflow-x-auto">
                        {activeFilterCount > 0 && (
                            <div className="px-5 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300 font-bold">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                                Mostrando {sortedFilteredMessengers.length} de {messengers.length} mensajeros
                            </div>
                        )}
                        <table className="min-w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th className="px-6 py-3 sticky left-0 bg-gray-50 dark:bg-gray-700 z-10 w-48">Mensajero</th>
                                    {days.filter(d => !dayFilter || d.format('YYYY-MM-DD') === dayFilter).map(d => (
                                        <th key={d.toString()} className="px-6 py-3 text-center min-w-[120px]">
                                            <div className="font-bold">{d.format('dddd')}</div>
                                            <div className="text-gray-400">{d.format('DD MMM')}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedFilteredMessengers.map(messenger => (
                                        <tr key={messenger.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 z-10">
                                                {messenger.name}
                                                <div className="text-xs text-slate-500">{messenger.vehicle}</div>
                                            </td>
                                            {days.filter(d => !dayFilter || d.format('YYYY-MM-DD') === dayFilter).map(d => {
                                                const dateStr = d.format('YYYY-MM-DD');
                                                const shift = messenger.shifts.find(s => s.date === dateStr);

                                                let cellClass = "px-2 py-4 text-center cursor-pointer transition border border-gray-100 dark:border-gray-700 ";
                                                if (shift) {
                                                    if (shift.status === 'absent') {
                                                        cellClass += "bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/50";
                                                    } else if (shift.location === 'teusaquillo') {
                                                        cellClass += "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40";
                                                    } else {
                                                        cellClass += "bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40";
                                                    }
                                                } else {
                                                    cellClass += "hover:bg-slate-50 dark:hover:bg-slate-700";
                                                }

                                                return (
                                                    <td
                                                        key={dateStr}
                                                        onClick={() => handleCellClick(messenger, dateStr, shift)}
                                                        className={cellClass}
                                                    >
                                                        {shift ? (
                                                            shift.status === 'absent' ? (
                                                                <span className="font-bold text-xs uppercase">No Asiste</span>
                                                            ) : (
                                                                <div className="flex flex-col text-xs font-mono">
                                                                    <span>{shift.start_time?.substring(0, 5)}</span>
                                                                    <span>-</span>
                                                                    <span>{shift.end_time?.substring(0, 5)}</span>
                                                                </div>
                                                            )
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-600 text-2xl">+</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ShiftModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                shift={selectedShift}
                date={modalDate}
                messengerName={modalMessenger?.name}
                onSave={handleSave}
                onDelete={handleDelete}
                errors={errors}
            />

            {/* Export Modal */}
            <Modal show={showExportModal} onClose={() => setShowExportModal(false)} maxWidth="sm">
                <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Exportar Reporte de Horarios</h2>

                    <div className="mb-4">
                        <InputLabel value="Fecha Inicio" />
                        <TextInput
                            type="date"
                            value={exportDates.start}
                            onChange={(e) => setExportDates({ ...exportDates, start: e.target.value })}
                            className="w-full"
                        />
                    </div>
                    <div className="mb-6">
                        <InputLabel value="Fecha Fin" />
                        <TextInput
                            type="date"
                            value={exportDates.end}
                            onChange={(e) => setExportDates({ ...exportDates, end: e.target.value })}
                            className="w-full"
                        />
                    </div>

                    <div className="flex justify-end space-x-3">
                        <SecondaryButton onClick={() => setShowExportModal(false)}>Cancelar</SecondaryButton>
                        <SuccessButton onClick={handleExport} className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            EXPORTAR
                        </SuccessButton>
                    </div>
                </div>
            </Modal>
        </LeaderLayout>
    );
}
