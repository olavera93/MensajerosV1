import React, { useState } from 'react';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import axios from 'axios';
import TextInput from '@/Components/TextInput';
import TextArea from '@/Components/TextArea';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import SuccessButton from '@/Components/SuccessButton';
import WarningButton from '@/Components/WarningButton';
import DangerButton from '@/Components/DangerButton';

export default function Landing() {
    const { flash, errors: pageErrors } = usePage().props;
    const [viewState, setViewState] = useState('search'); // search, options, active_lunch, preop_form, cleaning_form, etc.
    const [messenger, setMessenger] = useState(null);
    const [plate, setPlate] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeLunch, setActiveLunch] = useState(null);
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [weekShifts, setWeekShifts] = useState([]);
    const [shiftsLoading, setShiftsLoading] = useState(false);

    // Preoperational State
    const [preopQuestions, setPreopQuestions] = useState([]);
    const [preopAnswers, setPreopAnswers] = useState({});
    const [preopObservations, setPreopObservations] = useState('');
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    // Cleaning State
    const [cleaningItem, setCleaningItem] = useState(''); // maleta, moto
    const [cleaningType, setCleaningType] = useState(''); // semanal_superficial, mensual_profunda
    const [cleaningObservations, setCleaningObservations] = useState('');
    const [submittingCleaning, setSubmittingCleaning] = useState(false);

    // Lunch Form
    const { data, setData, post, processing, reset: resetForm } = useForm({
        messenger_id: '',
    });

    const handleLunchSubmit = () => {
        post(route('lunch.store'), {
            onSuccess: (page) => {
                setActiveLunch({
                    end: page.props.flash?.success?.return_time || '—'
                });
                setViewState('active_lunch');
            },
            onError: (errors) => {
                if (errors.lunch_duplicate) {
                    setViewState('lunch_duplicate_error');
                } else if (errors.messenger_inactive) {
                    alert(errors.messenger_inactive);
                    setViewState('options');
                }
            }
        });
    };

    const handleShiftSubmit = () => {
        post(route('shift-completion.store'), {
            onSuccess: () => setViewState('success_shift'),
            onError: (errors) => {
                if (errors.shift_duplicate) {
                    setViewState('shift_duplicate_error');
                } else if (errors.messenger_inactive) {
                    alert(errors.messenger_inactive);
                    setViewState('options');
                }
            }
        });
    };

    const loadPreopQuestions = async () => {
        setLoadingQuestions(true);
        setViewState('preop_form');
        try {
            const res = await axios.get(route('preoperational.questions'));
            setPreopQuestions(res.data.questions || []);
            const initialAnswers = {};
            (res.data.questions || []).forEach(q => {
                initialAnswers[q.key] = '';
            });
            setPreopAnswers(initialAnswers);
            setPreopObservations('');
        } catch (err) {
            alert('No se pudieron cargar las preguntas. Intenta de nuevo.');
            setViewState('options');
        } finally {
            setLoadingQuestions(false);
        }
    };

    const handlePreopSubmit = async (e) => {
        e.preventDefault();
        if (preopQuestions.length === 0) {
            alert('No hay preguntas cargadas. Regresa al menú e intenta de nuevo.');
            return;
        }
        const unanswered = preopQuestions.filter(q => preopAnswers[q.key] === '');
        if (unanswered.length > 0) {
            alert('Por favor responde todas las preguntas del checklist.');
            return;
        }

        try {
            await axios.post(route('preoperational.store'), {
                messenger_id: messenger.id,
                answers: preopAnswers,
                observations: preopObservations
            });
            setViewState('success_preop');
        } catch (error) {
            alert(error.response?.data?.error || 'Ocurrió un error guardando el reporte.');
            console.error(error);
        }
    };

    const handleCleaningSubmit = async (e) => {
        e.preventDefault();
        if (!cleaningItem || !cleaningType) {
            alert('Por favor selecciona el elemento y el tipo de aseo.');
            return;
        }

        setSubmittingCleaning(true);
        try {
            await axios.post(route('cleaning.store'), {
                messenger_id: messenger.id,
                item: cleaningItem,
                type: cleaningType,
                observations: cleaningObservations
            });
            setViewState('success_cleaning');
        } catch (error) {
            const errorData = error.response?.data;
            let errorMessage = errorData?.error || 'Ocurrió un error guardando el reporte.';

            if (errorData?.message) {
                errorMessage += `\n\nDetalles: ${errorData.message}`;
            }
            if (errorData?.file) {
                errorMessage += `\nArchivo: ${errorData.file} (Línea: ${errorData.line})`;
            }

            alert(errorMessage);
            console.error(error);
        } finally {
            setSubmittingCleaning(false);
        }
    };

    const checkPlate = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await axios.post(route('messenger.check-plate'), { plate });
            const mData = response.data;
            setMessenger(mData);
            setData('messenger_id', mData.id);

            if (mData.active_lunch) {
                setActiveLunch({
                    start: mData.active_lunch.start,
                    end: mData.active_lunch.end
                });
            }

            if (mData.shift_finished) {
                setViewState('shift_finished');
                return;
            }

            setViewState('options');
        } catch (err) {
            setError(err.response?.data?.error || 'Error en el sistema. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const loadShifts = async (week) => {
        setSelectedWeek(week);
        setShiftsLoading(true);
        try {
            const res = await axios.get(route('messenger.shifts', messenger.id), {
                params: { week }
            });
            setWeekShifts(res.data.shifts || []);
        } catch {
            setWeekShifts([]);
        } finally {
            setShiftsLoading(false);
        }
    };

    const resetAll = () => {
        setViewState('search');
        setMessenger(null);
        setPlate('');
        setError(null);
        setActiveLunch(null);
        setSelectedWeek(null);
        setWeekShifts([]);
        setCleaningItem('');
        setCleaningType('');
        setCleaningObservations('');
        resetForm();
    };

    // Success views
    if (viewState === 'success_cleaning') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 p-4">
                <Head title="Reporte de Aseo Enviado" />
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-l-4 border-blue-500">
                    <h1 className="text-3xl font-bold mb-4 text-blue-600 dark:text-blue-400">¡Aseo Reportado! ✨</h1>
                    <p className="text-xl mb-4">Gracias por mantener tus implementos de trabajo limpios y en buen estado.</p>
                    <PrimaryButton onClick={() => setViewState('options')} className="rounded-full mb-4 w-full">Volver al Menú</PrimaryButton>
                    <button onClick={resetAll} className="block w-full text-gray-600 dark:text-gray-400 font-bold hover:underline">Salir</button>
                </div>
            </div>
        );
    }

    if (viewState === 'success_preop') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 p-4">
                <Head title="Inspección Completada" />
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-l-4 border-green-500">
                    <h1 className="text-3xl font-bold mb-4 text-green-600 dark:text-green-400">¡Inspección Enviada! ✅</h1>
                    <p className="text-xl mb-4">Gracias por completar tu inspección preoperacional de hoy.</p>
                    <PrimaryButton onClick={() => setViewState('options')} className="rounded-full mb-4 w-full">Volver al Menú</PrimaryButton>
                    <button onClick={resetAll} className="block w-full text-gray-600 dark:text-gray-400 font-bold hover:underline">Salir</button>
                </div>
            </div>
        );
    }

    if (viewState === 'success_shift' && flash.success) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 p-4">
                <Head title="Buen descanso" />
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-l-4 border-indigo-500">
                    <h1 className="text-3xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">¡Buen descanso! 🌙</h1>
                    <p className="text-xl mb-4">Has finalizado tu turno correctamente. Gracias por tu trabajo hoy.</p>
                    <PrimaryButton onClick={() => setViewState('options')} className="rounded-full mb-4 w-full">Volver al Menú</PrimaryButton>
                    <button onClick={() => { resetAll(); window.location.reload(); }} className="block w-full text-gray-600 dark:text-gray-400 font-bold hover:underline">Salir</button>
                </div>
            </div>
        );
    }

    if (viewState === 'lunch_duplicate_error' && messenger) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 p-4">
                <Head title="Almuerzo Ya Registrado" />
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-l-4 border-orange-500">
                    <h1 className="text-2xl font-bold mb-4 text-orange-600 dark:text-orange-400">⚠️ Almuerzo Ya Registrado</h1>
                    <p className="text-xl mb-4 italic text-sm">Ya has reportado tu almuerzo el día de hoy.</p>
                    <PrimaryButton onClick={() => setViewState('options')} className="rounded-full mb-4 w-full mt-4">Regresar al Menú</PrimaryButton>
                    <button onClick={resetAll} className="block w-full text-gray-600 dark:text-gray-400 font-bold hover:underline">Salir</button>
                </div>
            </div>
        );
    }

    if (viewState === 'shift_duplicate_error' && messenger) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 p-4">
                <Head title="Turno Ya Finalizado" />
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-l-4 border-orange-500">
                    <h1 className="text-2xl font-bold mb-4 text-orange-600 dark:text-orange-400">⚠️ Turno Ya Finalizado</h1>
                    <p className="text-xl mb-4 italic text-sm">Ya has reportado tu fin de turno el día de hoy.</p>
                    <PrimaryButton onClick={() => setViewState('options')} className="rounded-full mb-4 w-full mt-4">Regresar al Menú</PrimaryButton>
                    <button onClick={resetAll} className="block w-full text-gray-600 dark:text-gray-400 font-bold hover:underline">Salir</button>
                </div>
            </div>
        );
    }

    // Other views (active_lunch, errors, etc.) handled in the main return or as conditional returns
    if (viewState === 'shift_finished' && messenger) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 p-4">
                <Head title="Turno Finalizado" />
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-l-4 border-gray-500">
                    <h1 className="text-2xl font-bold mb-4 text-gray-600 dark:text-gray-400">Turno Finalizado 🏁</h1>
                    <p className="text-xl mb-4">Hola <strong>{messenger.name}</strong>, ya registraste el fin de tu turno por hoy.</p>
                    <PrimaryButton onClick={() => setViewState('options')} className="rounded-full mb-4 w-full">Menú</PrimaryButton>
                    <button onClick={resetAll} className="block w-full text-gray-600 dark:text-gray-400 font-bold hover:underline">Salir</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 transition-colors duration-300 p-4">
            <Head title="Registro de Mensajeros" />

            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2 font-black tracking-tight">Logística LFH</h2>
                    {viewState === 'search' && <p className="text-gray-500 text-sm">Ingresa la placa de tu vehículo</p>}
                    {viewState === 'options' && <p className="text-gray-500 text-sm">Hola, <span className="font-bold text-indigo-500">{messenger?.name}</span></p>}
                </div>

                {/* Back Link for sub-views */}
                {viewState !== 'search' && viewState !== 'options' && (
                    <button
                        onClick={() => setViewState('options')}
                        className="mb-6 flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase hover:underline"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                        Regresar al Menú
                    </button>
                )}

                {viewState === 'search' && (
                    <form onSubmit={checkPlate} className="space-y-6">
                        <div>
                            <TextInput
                                type="text"
                                placeholder="Ej: AAA-123"
                                value={plate}
                                onChange={(e) => setPlate(e.target.value.toUpperCase().trim())}
                                className="w-full text-center text-3xl font-mono tracking-widest py-4 uppercase"
                                required
                                autoFocus
                            />
                            {error && <p className="text-red-500 text-center mt-2 font-bold text-xs">{error}</p>}
                        </div>
                        <PrimaryButton type="submit" disabled={loading} className="w-full justify-center py-4 text-sm">
                            {loading ? 'Buscando...' : 'BUSCAR VEHÍCULO'}
                        </PrimaryButton>
                    </form>
                )}

                {viewState === 'options' && (
                    <div className="space-y-4">
                        <PrimaryButton onClick={() => setViewState('shifts_view')} className="w-full py-5 flex items-center justify-between text-lg group">
                            <span className="flex items-center gap-3"><span className="text-2xl">📅</span><span>VER MIS HORARIOS</span></span>
                            <span className="text-indigo-200 group-hover:text-white">→</span>
                        </PrimaryButton>

                        <PrimaryButton
                            onClick={loadPreopQuestions}
                            disabled={messenger?.preop_finished}
                            className={`w-full py-5 flex items-center justify-between text-lg group ${messenger?.preop_finished ? 'bg-gray-400 border-gray-400 cursor-not-allowed text-gray-700' : 'bg-cyan-700 hover:bg-cyan-800 border-cyan-800'}`}
                        >
                            <span className="flex items-center gap-3"><span className="text-2xl">📋</span><span>{messenger?.preop_finished ? 'PREOPERACIONAL LISTO ✅' : 'PREOPERACIONAL'}</span></span>
                            {!messenger?.preop_finished && <span className="text-cyan-200 group-hover:text-white">→</span>}
                        </PrimaryButton>

                        <PrimaryButton
                            onClick={() => setViewState('cleaning_form')}
                            className="w-full py-5 flex items-center justify-between text-lg group bg-blue-600 hover:bg-blue-700 border-blue-700"
                        >
                            <span className="flex items-center gap-3"><span className="text-2xl">✨</span><span>INSPECCIÓN DE ASEO</span></span>
                            <span className="text-blue-200 group-hover:text-white">→</span>
                        </PrimaryButton>

                        <PrimaryButton onClick={() => setViewState('forms_view')} className="w-full py-5 flex items-center justify-between text-lg group bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 border-slate-700">
                            <span className="flex items-center gap-3"><span className="text-2xl">📝</span><span>FORMULARIOS</span></span>
                            <span className="text-slate-400 group-hover:text-white">→</span>
                        </PrimaryButton>

                        <SuccessButton
                            onClick={() => activeLunch ? setViewState('active_lunch') : setViewState('lunch_confirm')}
                            className="w-full py-5 flex items-center justify-between text-lg group"
                            disabled={messenger?.shift_finished}
                        >
                            <span className="flex items-center gap-3">
                                <span className="text-2xl">🍽️</span>
                                <span>{activeLunch ? 'HORARIO DE ALMUERZO' : 'REGISTRAR ALMUERZO'}</span>
                                {activeLunch && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full ml-1">EN CURSO</span>}
                            </span>
                            {!messenger?.shift_finished && <span className="text-emerald-200 group-hover:text-white">→</span>}
                        </SuccessButton>

                        <WarningButton onClick={() => setViewState('shift_confirm')} className="w-full py-5 flex items-center justify-between text-lg group" disabled={messenger?.shift_finished}>
                            <span className="flex items-center gap-3"><span className="text-2xl">🏁</span><span>REPORTAR FIN TURNO</span></span>
                            {!messenger?.shift_finished && <span className="text-amber-200 group-hover:text-white">→</span>}
                        </WarningButton>

                        <SecondaryButton onClick={resetAll} className="w-full justify-center mt-4">CANCELAR / SALIR</SecondaryButton>
                    </div>
                )}

                {viewState === 'cleaning_form' && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-center flex items-center justify-center gap-2 mb-2">
                            <span>✨</span> Seguimiento de Aseo
                        </h3>

                        <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 p-3 rounded-lg text-sm border border-blue-100 dark:border-blue-800 font-medium mb-4 text-center text-xs uppercase">
                            Vehículo: <span className="font-bold">{messenger?.vehicle}</span> | {messenger?.name}
                        </div>

                        <form onSubmit={handleCleaningSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">1. ¿Qué limpiaste?</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setCleaningItem('maleta')}
                                        className={`p-4 rounded-xl border-2 transition-all font-bold text-sm ${cleaningItem === 'maleta' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'}`}
                                    >
                                        🎒 MALETA
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCleaningItem('moto')}
                                        className={`p-4 rounded-xl border-2 transition-all font-bold text-sm ${cleaningItem === 'moto' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'}`}
                                    >
                                        🛵 MOTO
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">2. Tipo de Limpieza</label>
                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setCleaningType('semanal_superficial')}
                                        className={`p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between ${cleaningType === 'semanal_superficial' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'}`}
                                    >
                                        <div>
                                            <p className="font-bold text-sm">SEMANAL</p>
                                            <p className="text-[10px] opacity-70">Aseo superficial obligatorio</p>
                                        </div>
                                        {cleaningType === 'semanal_superficial' && <span>✅</span>}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCleaningType('mensual_profunda')}
                                        className={`p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between ${cleaningType === 'mensual_profunda' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'}`}
                                    >
                                        <div>
                                            <p className="font-bold text-sm">MENSUAL</p>
                                            <p className="text-[10px] opacity-70">Desinfección y aseo profundo</p>
                                        </div>
                                        {cleaningType === 'mensual_profunda' && <span>✅</span>}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">3. Observaciones (Opcional)</label>
                                <TextArea
                                    value={cleaningObservations}
                                    onChange={(e) => setCleaningObservations(e.target.value)}
                                    placeholder="Comentarios adicionales..."
                                    className="w-full text-xs"
                                    rows="2"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <SecondaryButton onClick={() => setViewState('options')} className="justify-center">Cancelar</SecondaryButton>
                                <PrimaryButton type="submit" disabled={submittingCleaning} className="justify-center bg-indigo-600">
                                    {submittingCleaning ? 'Enviando...' : 'Enviar Reporte'}
                                </PrimaryButton>
                            </div>
                        </form>
                    </div>
                )}

                {viewState === 'preop_form' && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2">📋 Inspección Preoperacional</h3>
                        <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 p-3 rounded-lg text-sm border border-blue-100 dark:border-blue-800 font-medium mb-4 text-center">Vehículo: <span className="font-bold">{messenger?.vehicle}</span></div>
                        {loadingQuestions ? (
                            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>
                        ) : (
                            <form onSubmit={handlePreopSubmit} className="space-y-6">
                                <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-6">
                                    {Object.entries(preopQuestions.reduce((acc, q) => {
                                        if (!acc[q.category]) acc[q.category] = [];
                                        acc[q.category].push(q);
                                        return acc;
                                    }, {})).map(([category, questions]) => (
                                        <div key={category} className="bg-white dark:bg-gray-800 rounded-xl border-2 border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                                            <div className="bg-slate-50 dark:bg-slate-700 px-4 py-2 border-b-2 border-slate-100 dark:border-slate-600 text-xs font-black uppercase">{category}</div>
                                            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {questions.map((q) => (
                                                    <div key={q.id} className="p-4 flex flex-col justify-between gap-3">
                                                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{q.label}</span>
                                                        <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
                                                            <button type="button" onClick={() => setPreopAnswers({ ...preopAnswers, [q.key]: true })} className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${preopAnswers[q.key] === true ? 'bg-green-500 text-white shadow' : 'text-slate-500'}`}>SÍ</button>
                                                            <button type="button" onClick={() => setPreopAnswers({ ...preopAnswers, [q.key]: false })} className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${preopAnswers[q.key] === false ? 'bg-red-500 text-white shadow' : 'text-slate-500'}`}>NO</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    <TextArea value={preopObservations} onChange={(e) => setPreopObservations(e.target.value)} placeholder="Observaciones adicionales..." className="w-full text-xs" rows="2" />
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <SecondaryButton onClick={() => setViewState('options')} className="justify-center">Cancelar</SecondaryButton>
                                    <PrimaryButton type="submit" className="justify-center">Enviar Reporte</PrimaryButton>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {viewState === 'forms_view' && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-center">📝 Formularios</h3>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                            {messenger?.external_forms?.length > 0 ? messenger.external_forms.map((form, i) => (
                                <a key={i} href={form.url} target="_blank" rel="noopener noreferrer" className="block p-5 bg-white dark:bg-gray-700 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 transition-all group">
                                    <div className="flex justify-between items-center"><h4 className="font-bold text-slate-800 dark:text-slate-100 uppercase">{form.title}</h4><span>→</span></div>
                                </a>
                            )) : <div className="text-center py-10 text-slate-400 italic">No hay formularios disponibles.</div>}
                        </div>
                        <SecondaryButton onClick={() => setViewState('options')} className="w-full justify-center py-4">Volver</SecondaryButton>
                    </div>
                )}

                {viewState === 'shifts_view' && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-center">Mis Turnos</h3>
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button
                                onClick={() => loadShifts('current')}
                                className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs ${selectedWeek === 'current' ? 'bg-white shadow' : 'text-gray-500'}`}
                            >
                                ESTA SEMANA
                            </button>
                            <button
                                onClick={() => loadShifts('next')}
                                className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs ${selectedWeek === 'next' ? 'bg-white shadow' : 'text-gray-500'}`}
                            >
                                PRÓX. SEMANA
                            </button>
                        </div>
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                            {shiftsLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                                </div>
                            ) : selectedWeek === null ? (
                                <p className="text-center text-gray-400 py-8 text-sm">Selecciona una semana para ver tus turnos.</p>
                            ) : weekShifts.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">Sin turnos registrados.</p>
                            ) : (
                                weekShifts.map((shift, i) => (
                                    <div key={i} className={`p-4 rounded-lg border-l-4 ${shift.is_today ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-gray-300'}`}>
                                        <p className="font-bold text-xs uppercase">{shift.date}</p>
                                        <p className="text-xs">
                                            {shift.start_time === 'NO ASISTE' || shift.start_time === 'SIN TURNO'
                                                ? <span className="font-black text-red-500">{shift.start_time}</span>
                                                : `${shift.start_time} - ${shift.end_time}`}
                                            {shift.location !== '-' && ` | `}
                                            <span className="font-bold">{shift.location !== '-' ? shift.location : ''}</span>
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                        <SecondaryButton onClick={() => setViewState('options')} className="w-full justify-center">Volver</SecondaryButton>
                    </div>
                )}

                {viewState === 'lunch_confirm' && (
                    <div className="space-y-6 text-center">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">¿Iniciar Almuerzo?</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <SecondaryButton onClick={() => setViewState('options')} className="justify-center">No</SecondaryButton>
                            <SuccessButton onClick={handleLunchSubmit} disabled={processing} className="justify-center">Si</SuccessButton>
                        </div>
                    </div>
                )}

                {viewState === 'shift_confirm' && (
                    <div className="space-y-6 text-center">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">¿Finalizar Turno?</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <SecondaryButton onClick={() => setViewState('options')} className="justify-center">No</SecondaryButton>
                            <WarningButton onClick={handleShiftSubmit} disabled={processing} className="justify-center">Si</WarningButton>
                        </div>
                    </div>
                )}

                {viewState === 'active_lunch' && messenger && activeLunch && (
                    <div className="space-y-6 text-center">
                        <h1 className="text-2xl font-black text-green-600">¡A almorzar! 🍔</h1>
                        <p className="text-lg">Debes regresar a las:</p>
                        <div className="text-5xl font-mono font-black text-indigo-600">{activeLunch.end}</div>
                        <button onClick={resetAll} className="block w-full text-gray-500 font-bold hover:underline">Salir</button>
                    </div>
                )}
            </div>
        </div>
    );
}
