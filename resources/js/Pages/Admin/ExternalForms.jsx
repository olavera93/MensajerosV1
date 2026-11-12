import React from 'react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import { Head, useForm, router } from '@inertiajs/react';
import TextInput from '@/Components/TextInput';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { toast } from 'sonner';
import useCan from '@/hooks/useCan';

export default function ExternalForms({ forms }) {
    const can = useCan();
    const { data, setData, post, processing, errors, reset } = useForm({
        title: '',
        url: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('external-forms.store'), {
            onSuccess: () => {
                reset();
                toast.success('Formulario agregado');
            },
        });
    };

    const deleteForm = (id) => {
        if (confirm('¿Estás seguro de eliminar este formulario?')) {
            router.delete(route('external-forms.destroy', id), {
                onSuccess: () => toast.success('Formulario eliminado'),
            });
        }
    };

    return (
        <LeaderLayout title="Gestión de Formularios">
            <Head title="Formularios" />

            <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
                {can('formularios.editar') && (
                    <div className="bg-white dark:bg-slate-800 shadow-sm rounded-2xl overflow-hidden mb-8 border border-slate-200 dark:border-slate-700">
                        <div className="p-6">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-4 flex items-center gap-2">
                                <span>📝</span> Nuevo Formulario
                            </h3>
                            <form onSubmit={submit} className="space-y-4">
                                <div>
                                    <InputLabel htmlFor="title" value="Título del Formulario" />
                                    <TextInput
                                        id="title"
                                        type="text"
                                        value={data.title}
                                        className="mt-1 block w-full"
                                        onChange={(e) => setData('title', e.target.value)}
                                        placeholder="Ej: Reporte de Novedades"
                                        required
                                    />
                                    {errors.title && <div className="text-red-500 text-xs mt-1">{errors.title}</div>}
                                </div>

                                <div>
                                    <InputLabel htmlFor="url" value="URL (Link)" />
                                    <TextInput
                                        id="url"
                                        type="url"
                                        value={data.url}
                                        className="mt-1 block w-full"
                                        onChange={(e) => setData('url', e.target.value)}
                                        placeholder="https://forms.gle/..."
                                        required
                                    />
                                    {errors.url && <div className="text-red-500 text-xs mt-1">{errors.url}</div>}
                                </div>

                                <div className="flex justify-end">
                                    <PrimaryButton disabled={processing}>
                                        {processing ? 'Guardando...' : 'Agregar Formulario'}
                                    </PrimaryButton>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-slate-800 shadow-sm rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <div className="p-6">
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-6 flex items-center gap-2">
                            <span>📋</span> Lista de Formularios
                        </h3>

                        {forms.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 italic">
                                No hay formularios registrados aún.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {forms.map((form) => (
                                    <div key={form.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 transition-all hover:shadow-md">
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate">{form.title}</h4>
                                            <p className="text-xs text-indigo-500 truncate font-mono">{form.url}</p>
                                        </div>
                                        <div className="flex items-center gap-2 ml-4">
                                            <a
                                                href={form.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                                title="Probar link"
                                            >
                                                🔗
                                            </a>
                                            {can('formularios.editar') && (
                                                <button
                                                    onClick={() => {
                                                        if (confirm('¿Seguro?')) {
                                                            router.delete(route('external-forms.destroy', form.id));
                                                        }
                                                    }}
                                                    className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </LeaderLayout>
    );
}
