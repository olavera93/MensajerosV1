import React, { useState, useMemo } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import InputLabel from '@/Components/InputLabel';
import InputError from '@/Components/InputError';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import isoWeek from 'dayjs/plugin/isoWeek';
dayjs.extend(isoWeek);
dayjs.locale('es');

const EMPTY_FORM = { title: '', start_datetime: '', end_datetime: '', scope: 'all', messenger_ids: [] };
const DAY_H   = 40;  // px — altura fila de números de día
const EVENT_H = 26;  // px — altura de cada barra de evento
const MAX_ROWS = 4;  // filas visibles de eventos por semana

// ── Algoritmo de posicionamiento ──────────────────────────────────────────────
function layoutWeekEvents(events, weekDays) {
    const weekStart = weekDays[0];
    const weekEnd   = weekDays[6];

    const filtered = events
        .filter(ev => {
            const s = dayjs(ev.start_datetime).startOf('day');
            const e = dayjs(ev.end_datetime).startOf('day');
            return s.isBefore(weekEnd.add(1, 'day')) && e.isAfter(weekStart.subtract(1, 'day'));
        })
        .map(ev => {
            const evStart = dayjs(ev.start_datetime).startOf('day');
            const evEnd   = dayjs(ev.end_datetime).startOf('day');

            const displayStart = evStart.isBefore(weekStart) ? weekStart : evStart;
            const displayEnd   = evEnd.isAfter(weekEnd)      ? weekEnd   : evEnd;

            const col    = weekDays.findIndex(d => d.isSame(displayStart, 'day'));
            const endCol = weekDays.findIndex(d => d.isSame(displayEnd,   'day'));

            return {
                ...ev,
                col:              Math.max(0, col),
                span:             Math.max(1, endCol - col + 1),
                continuesFromPrev: evStart.isBefore(weekStart),
                continuesToNext:   evEnd.isAfter(weekEnd),
            };
        })
        // "todos" primero, luego por fecha inicio
        .sort((a, b) => {
            if (a.scope !== b.scope) return a.scope === 'all' ? -1 : 1;
            return dayjs(a.start_datetime).diff(dayjs(b.start_datetime));
        });

    // Asignar filas evitando solapamiento
    const slots = [];
    return filtered.map(ev => {
        let row = 0;
        while (true) {
            if (!slots[row]) slots[row] = [];
            const clash = slots[row].some(s => ev.col < s.col + s.span && ev.col + ev.span > s.col);
            if (!clash) { slots[row].push({ col: ev.col, span: ev.span }); return { ...ev, row }; }
            row++;
        }
    });
}

export default function EventsIndex({ auth, events, messengers }) {
    const { flash } = usePage().props;
    const [currentMonth, setCurrentMonth] = useState(() => dayjs().startOf('month'));
    const [showModal, setShowModal]       = useState(false);
    const [editing,   setEditing]         = useState(null);
    const [form,      setForm]            = useState(EMPTY_FORM);
    const [errors,    setErrors]          = useState({});
    const [submitting, setSubmitting]     = useState(false);
    const [messengerSearch, setMessengerSearch] = useState('');
    const [tooltip, setTooltip] = useState(null); // { ev, x, y }

    // Grid de 6 semanas empezando en el lunes de la semana que contiene el día 1
    const weeks = useMemo(() => {
        const start = currentMonth.startOf('month').startOf('isoWeek');
        return Array.from({ length: 6 }, (_, w) =>
            Array.from({ length: 7 }, (_, d) => start.add(w * 7 + d, 'day'))
        );
    }, [currentMonth]);

    const today = dayjs();

    // ── Handlers de modal ──────────────────────────────────────────────────────
    const openCreate = (day = null) => {
        setEditing(null);
        setForm({
            ...EMPTY_FORM,
            start_datetime: day ? day.format('YYYY-MM-DD') + 'T08:00' : '',
            end_datetime:   day ? day.format('YYYY-MM-DD') + 'T17:00' : '',
        });
        setErrors({});
        setMessengerSearch('');
        setShowModal(true);
    };

    const openEdit = (ev) => {
        setEditing(ev);
        setForm({
            title:          ev.title,
            start_datetime: ev.start_datetime,
            end_datetime:   ev.end_datetime,
            scope:          ev.scope,
            messenger_ids:  ev.messenger_ids.map(Number),
        });
        setErrors({});
        setMessengerSearch('');
        setShowModal(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitting(true);
        const payload = { ...form };
        if (payload.scope === 'all') payload.messenger_ids = [];

        const method = editing ? 'put'  : 'post';
        const url    = editing ? route('events.update', editing.id) : route('events.store');

        router[method](url, payload, {
            onSuccess: () => { setShowModal(false); setSubmitting(false); },
            onError:   (err) => { setErrors(err); setSubmitting(false); },
        });
    };

    const toggleMessenger = (id) =>
        setForm(f => ({
            ...f,
            messenger_ids: f.messenger_ids.includes(id)
                ? f.messenger_ids.filter(m => m !== id)
                : [...f.messenger_ids, id],
        }));

    const filteredMessengers = messengers.filter(m =>
        m.name.toLowerCase().includes(messengerSearch.toLowerCase())
    );

    // ── Render ─────────────────────────────────────────────────────────────────
    const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    return (
        <LeaderLayout
            user={auth.user}
            header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">Eventos</h2>}
        >
            <Head title="Eventos" />

            <div className="py-6 sm:py-8">
                <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">

                    {flash?.success && (
                        <div className="mb-4 px-4 py-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl text-green-700 dark:text-green-300 text-sm font-medium">
                            {flash.success}
                        </div>
                    )}

                    {/* ── Cabecera del calendario ── */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentMonth(m => m.subtract(1, 'month'))}
                                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
                            >
                                <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>

                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 capitalize min-w-[160px] text-center">
                                {currentMonth.format('MMMM YYYY')}
                            </h3>

                            <button
                                onClick={() => setCurrentMonth(m => m.add(1, 'month'))}
                                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
                            >
                                <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>

                            <button
                                onClick={() => setCurrentMonth(dayjs().startOf('month'))}
                                className="ml-1 px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition shadow-sm"
                            >
                                Hoy
                            </button>
                        </div>

                        <PrimaryButton onClick={() => openCreate()} className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                            </svg>
                            Nuevo Evento
                        </PrimaryButton>
                    </div>

                    {/* ── Cuadrícula del calendario ── */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700">

                        {/* Días de la semana */}
                        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                            {DOW.map(d => (
                                <div key={d} className="py-2 text-center text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Semanas */}
                        {weeks.map((weekDays, wi) => {
                            const positioned = layoutWeekEvents(events, weekDays);
                            const maxRow     = positioned.length ? Math.max(...positioned.map(e => e.row)) + 1 : 0;
                            const visibleRows = Math.min(maxRow, MAX_ROWS);
                            const rowHeight  = DAY_H + visibleRows * EVENT_H + 6;

                            return (
                                <div
                                    key={wi}
                                    className="relative border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                                    style={{ minHeight: `${rowHeight}px` }}
                                >
                                    {/* Celdas de días (fondo + número + handler de click) */}
                                    <div className="absolute inset-0 grid grid-cols-7">
                                        {weekDays.map((day, di) => {
                                            const inMonth  = day.isSame(currentMonth, 'month');
                                            const isToday  = day.isSame(today, 'day');
                                            // Eventos ocultos que pasan por este día
                                            const hiddenHere = positioned.filter(ev =>
                                                ev.row >= MAX_ROWS && di >= ev.col && di < ev.col + ev.span
                                            ).length;

                                            return (
                                                <div
                                                    key={di}
                                                    onClick={() => openCreate(day)}
                                                    className={`
                                                        relative border-r border-slate-100 dark:border-slate-700 last:border-r-0
                                                        cursor-pointer select-none
                                                        ${inMonth ? 'hover:bg-indigo-50/60 dark:hover:bg-indigo-900/10' : 'bg-slate-50/70 dark:bg-slate-800/40'}
                                                        transition-colors
                                                    `}
                                                >
                                                    <span className={`
                                                        inline-flex items-center justify-center w-7 h-7 m-0.5 rounded-full text-sm font-bold
                                                        ${isToday
                                                            ? 'bg-indigo-600 text-white'
                                                            : inMonth
                                                                ? 'text-slate-700 dark:text-slate-200'
                                                                : 'text-slate-300 dark:text-slate-600'}
                                                    `}>
                                                        {day.date()}
                                                    </span>
                                                    {hiddenHere > 0 && (
                                                        <span className="absolute bottom-1 left-1 text-[10px] text-slate-400 font-bold">
                                                            +{hiddenHere}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Barras de eventos */}
                                    {positioned.filter(ev => ev.row < MAX_ROWS).map(ev => {
                                        const isAll    = ev.scope === 'all';
                                        const leftPct  = (ev.col / 7) * 100;
                                        const widthPct = (ev.span / 7) * 100;

                                        return (
                                            <div
                                                key={ev.id}
                                                onClick={e => { e.stopPropagation(); openEdit(ev); }}
                                                onMouseEnter={e => {
                                                    const r = e.currentTarget.getBoundingClientRect();
                                                    setTooltip({ ev, x: r.left + r.width / 2, y: r.top });
                                                }}
                                                onMouseLeave={() => setTooltip(null)}
                                                style={{
                                                    position: 'absolute',
                                                    top:    `${DAY_H + ev.row * EVENT_H}px`,
                                                    left:   `calc(${leftPct}% + ${ev.continuesFromPrev ? 0 : 3}px)`,
                                                    width:  `calc(${widthPct}% - ${(ev.continuesFromPrev ? 0 : 3) + (ev.continuesToNext ? 0 : 3)}px)`,
                                                    height: `${EVENT_H - 3}px`,
                                                    zIndex: 10,
                                                }}
                                                className={`
                                                    flex items-center px-2 text-[11px] font-bold text-white cursor-pointer
                                                    hover:brightness-110 transition-all
                                                    ${isAll ? 'bg-indigo-500 dark:bg-indigo-600' : 'bg-violet-500 dark:bg-violet-600'}
                                                    ${ev.continuesFromPrev ? 'rounded-r-full' : 'rounded-l-full rounded-r-full'}
                                                    ${ev.continuesToNext   ? 'rounded-r-none' : ''}
                                                `}
                                            >
                                                {ev.continuesFromPrev && <span className="mr-1 opacity-70 shrink-0">‹</span>}
                                                <span className="truncate">{ev.title}</span>
                                                {ev.continuesToNext && <span className="ml-1 opacity-70 shrink-0">›</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>

                    {/* Leyenda */}
                    <div className="flex items-center gap-4 mt-3 px-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-indigo-500" />
                            <span className="text-[11px] text-slate-400 font-medium">Para todos</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-violet-500" />
                            <span className="text-[11px] text-slate-400 font-medium">Específico</span>
                        </div>
                        <span className="text-[11px] text-slate-300">· Click en un día para agregar</span>
                    </div>
                </div>
            </div>

            {/* ── Tooltip flotante (fixed, fuera del overflow-hidden del calendario) ── */}
            {tooltip && (
                <div
                    className="fixed z-[9999] pointer-events-none"
                    style={{ left: tooltip.x, top: tooltip.y - 10, transform: 'translate(-50%, -100%)' }}
                >
                    <div className="bg-slate-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-2xl min-w-[120px] max-w-[220px]">
                        <p className="font-black text-[11px] text-slate-300 uppercase tracking-wider mb-1.5">
                            {tooltip.ev.scope === 'all' ? 'Responsable' : `${tooltip.ev.messenger_names.length} responsable${tooltip.ev.messenger_names.length !== 1 ? 's' : ''}`}
                        </p>
                        {tooltip.ev.scope === 'all' ? (
                            <span className="inline-flex items-center gap-1 bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
                                Todos los mensajeros
                            </span>
                        ) : (
                            <div className="flex flex-col gap-1">
                                {tooltip.ev.messenger_names.map((name, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 bg-violet-500/30 text-violet-200 px-2 py-0.5 rounded-full text-[11px] font-bold truncate">
                                        {name}
                                    </span>
                                ))}
                            </div>
                        )}
                        {/* Flecha */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900" />
                    </div>
                </div>
            )}

            {/* ── Modal crear / editar ── */}
            <Modal show={showModal} onClose={() => setShowModal(false)} maxWidth="lg">
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black text-gray-900 dark:text-gray-100">
                            {editing ? 'Editar Evento' : 'Nuevo Evento'}
                        </h2>
                        {editing && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (!confirm('¿Eliminar este evento?')) return;
                                    setShowModal(false);
                                    router.delete(route('events.destroy', editing.id));
                                }}
                                className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Eliminar
                            </button>
                        )}
                    </div>

                    {/* Título */}
                    <div>
                        <InputLabel value="Tarea / Descripción" />
                        <TextInput
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="Ej: Recoger similares en punto norte"
                            className="w-full mt-1"
                            autoFocus
                        />
                        <InputError message={errors.title} className="mt-1" />
                    </div>

                    {/* Fechas */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <InputLabel value="Inicio" />
                            <TextInput
                                type="datetime-local"
                                value={form.start_datetime}
                                onChange={e => setForm(f => ({ ...f, start_datetime: e.target.value }))}
                                className="w-full mt-1"
                            />
                            <InputError message={errors.start_datetime} className="mt-1" />
                        </div>
                        <div>
                            <InputLabel value="Fin" />
                            <TextInput
                                type="datetime-local"
                                value={form.end_datetime}
                                onChange={e => setForm(f => ({ ...f, end_datetime: e.target.value }))}
                                className="w-full mt-1"
                            />
                            <InputError message={errors.end_datetime} className="mt-1" />
                        </div>
                    </div>

                    {/* Responsable */}
                    <div>
                        <InputLabel value="Responsable" />
                        <div className="flex gap-3 mt-2">
                            <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, scope: 'all', messenger_ids: [] }))}
                                className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${form.scope === 'all' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-600 text-slate-400'}`}
                            >
                                Todos
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, scope: 'specific' }))}
                                className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${form.scope === 'specific' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : 'border-slate-200 dark:border-slate-600 text-slate-400'}`}
                            >
                                Específico
                            </button>
                        </div>
                    </div>

                    {/* Selector de mensajeros */}
                    {form.scope === 'specific' && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <InputLabel value={`Mensajeros (${form.messenger_ids.length} seleccionados)`} />
                                {form.messenger_ids.length > 0 && (
                                    <button type="button" onClick={() => setForm(f => ({ ...f, messenger_ids: [] }))} className="text-[11px] text-slate-400 hover:text-red-500 font-bold">
                                        Limpiar
                                    </button>
                                )}
                            </div>
                            <TextInput
                                value={messengerSearch}
                                onChange={e => setMessengerSearch(e.target.value)}
                                placeholder="Filtrar mensajeros..."
                                className="w-full mb-2 text-sm"
                            />
                            <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                                {filteredMessengers.map(m => {
                                    const checked = form.messenger_ids.includes(m.id);
                                    return (
                                        <label
                                            key={m.id}
                                            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b last:border-b-0 border-slate-100 dark:border-slate-700 ${checked ? 'bg-violet-50 dark:bg-violet-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleMessenger(m.id)}
                                                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                                            />
                                            <span className={`text-sm font-medium ${checked ? 'text-violet-700 dark:text-violet-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {m.name}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            <InputError message={errors.messenger_ids} className="mt-1" />
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <SecondaryButton type="button" onClick={() => setShowModal(false)}>Cancelar</SecondaryButton>
                        <PrimaryButton type="submit" disabled={submitting}>
                            {submitting ? 'Guardando...' : (editing ? 'Actualizar' : 'Crear')}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>
        </LeaderLayout>
    );
}
