import React from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import PrimaryButton from '@/Components/PrimaryButton';
import InputError from '@/Components/InputError';

const HINTS = {
    disponible: 'Con turno activo y sin ruta abierta.',
    ruta: 'Tiene una ruta abierta en DispatchTrack.',
    almuerzo: 'Dentro de su horario de almuerzo.',
    'por-iniciar': 'Su turno de hoy aún no ha empezado.',
    finalizado: 'Ya reportó el fin de su turno.',
};

export default function SettingsIndex({ states, assignable, canEdit }) {
    const { flash } = usePage().props;
    const { data, setData, put, processing, errors, isDirty, setDefaults } = useForm({ assignable });

    const toggle = (key) => {
        setData('assignable', data.assignable.includes(key) ? data.assignable.filter(k => k !== key) : [...data.assignable, key]);
    };

    const submit = (e) => {
        e.preventDefault();
        put(route('settings.update'), { preserveScroll: true, onSuccess: () => setDefaults() });
    };

    return (
        <LeaderLayout title="Configuración">
            <Head title="Configuración" />

            <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-6">Configuración</h1>

                <form onSubmit={submit} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-700">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Asignación de rutas por estado</h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            Elige en qué estados se puede asignar ruta a un mensajero. En los demás, el dashboard no muestra el botón Asignar y el servidor rechaza la asignación.
                        </p>
                    </div>

                    <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                        {states.map(s => {
                            const on = data.assignable.includes(s.key);
                            return (
                                <li key={s.key}>
                                    <label className={`flex items-center gap-4 px-5 py-3.5 ${canEdit ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40' : ''}`}>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">{s.label}</div>
                                            <div className="text-xs text-slate-600 dark:text-slate-400">{HINTS[s.key]}</div>
                                        </div>
                                        <span className={`text-xs font-bold ${on ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {on ? 'Permite asignar' : 'No permite'}
                                        </span>
                                        <input
                                            type="checkbox"
                                            role="switch"
                                            className="sr-only peer"
                                            checked={on}
                                            disabled={!canEdit}
                                            onChange={() => toggle(s.key)}
                                        />
                                        <span aria-hidden="true" className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 ${on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'} ${canEdit ? '' : 'opacity-60'}`}>
                                            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>

                    <div className="p-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                        <InputError message={errors.assignable || Object.entries(errors).find(([k]) => k.startsWith('assignable.'))?.[1]} className="mr-auto" />
                        {flash?.success && !isDirty && <span className="mr-auto text-sm font-semibold text-emerald-700 dark:text-emerald-400">{flash.success}</span>}
                        {canEdit ? (
                            <PrimaryButton disabled={processing || !isDirty}>Guardar</PrimaryButton>
                        ) : (
                            <span className="text-sm text-slate-500 dark:text-slate-400">Solo lectura: no tienes permiso para editar la configuración.</span>
                        )}
                    </div>
                </form>
            </div>
        </LeaderLayout>
    );
}
