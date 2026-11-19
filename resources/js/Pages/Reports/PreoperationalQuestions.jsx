import React, { useState } from 'react';
import LeaderLayout from '@/Layouts/LeaderLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';

export default function PreoperationalQuestions({ auth, questions }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    const { data, setData, post, put, delete: destroy, processing, errors, reset } = useForm({
        category: '',
        label: '',
        key: '',
        active: true,
        order: 0,
    });

    const openCreateModal = () => {
        setIsEditing(false);
        setEditId(null);
        reset();
        setIsModalOpen(true);
    };

    const openEditModal = (q) => {
        setIsEditing(true);
        setEditId(q.id);
        setData({
            category: q.category,
            label: q.label,
            key: q.key,
            active: Boolean(q.active),
            order: q.order || 0
        });
        setIsModalOpen(true);
    };

    const submit = (e) => {
        e.preventDefault();
        if (isEditing) {
            put(route('reports.preoperational.questions.update', editId), {
                onSuccess: () => setIsModalOpen(false),
            });
        } else {
            post(route('reports.preoperational.questions.store'), {
                onSuccess: () => setIsModalOpen(false),
            });
        }
    };

    const handleDelete = (id) => {
        if (confirm('¿Estás seguro de eliminar esta pregunta?')) {
            destroy(route('reports.preoperational.questions.destroy', id));
        }
    };

    return (
        <LeaderLayout
            user={auth.user}
            header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">Configuración de Preguntas Preoperacional</h2>}
        >
            <Head title="Configuración de Preguntas" />

            <div className="py-8">
                <div className="w-full max-w-[1800px] mx-auto sm:px-6 lg:px-8">

                    {/* Header */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Link
                                href={route('reports.preoperational')}
                                className="text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 font-medium text-sm flex items-center gap-2"
                            >
                                <span>←</span> Volver a la Tabla
                            </Link>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Preguntas</h3>
                        </div>

                        <button
                            onClick={openCreateModal}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            AÑADIR PREGUNTA
                        </button>
                    </div>

                    {/* Tarjetas (móvil) */}
                    <div className="sm:hidden space-y-3">
                        {questions.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">No hay preguntas configuradas.</p>
                        ) : questions.map(q => (
                            <div key={q.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">#{q.order} · {q.category}</p>
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mt-0.5">{q.label}</p>
                                        <p className="text-[11px] text-gray-400 font-mono truncate">{q.key}</p>
                                    </div>
                                    <span className={`shrink-0 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${q.active ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'}`}>
                                        {q.active ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <button onClick={() => openEditModal(q)} className="py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-xs font-bold">Editar</button>
                                    <button onClick={() => handleDelete(q.id)} className="py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold">Eliminar</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tabla */}
                    <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 flex flex-col w-full">
                                    <tr className="flex w-full">
                                        <th className="w-16 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orden</th>
                                        <th className="w-1/4 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                                        <th className="w-1/4 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Label</th>
                                        <th className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
                                        <th className="w-1/6 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                        <th className="w-24 px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 flex flex-col w-full">
                                    {questions.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                                No hay preguntas configuradas.
                                            </td>
                                        </tr>
                                    ) : (
                                        questions.map(q => (
                                            <tr key={q.id} className="flex w-full hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                                <td className="w-16 px-6 py-4 text-sm font-semibold text-gray-500">{q.order}</td>
                                                <td className="w-1/4 px-6 py-4 text-sm text-gray-700 dark:text-gray-300 font-medium">{q.category}</td>
                                                <td className="w-1/4 px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{q.label}</td>
                                                <td className="w-1/6 px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">{q.key}</td>
                                                <td className="w-1/6 px-6 py-4 text-center">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${q.active ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'}`}>
                                                        {q.active ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </td>
                                                <td className="w-24 px-6 py-4 text-sm font-medium text-right flex justify-end gap-3">
                                                    <button onClick={() => openEditModal(q)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">Editar</button>
                                                    <button onClick={() => handleDelete(q.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Eliminar</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl z-50 max-w-md w-full p-6 border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <h4 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">
                            {isEditing ? 'Editar Pregunta' : 'Añadir Pregunta'}
                        </h4>

                        <form onSubmit={submit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
                                <input
                                    type="text"
                                    value={data.category}
                                    onChange={e => setData('category', e.target.value)}
                                    className="w-full border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Ej. Estado Mecánico"
                                    required
                                />
                                {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pregunta (Label)</label>
                                <input
                                    type="text"
                                    value={data.label}
                                    onChange={e => setData('label', e.target.value)}
                                    className="w-full border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Ej. Estado de llantas"
                                    required
                                />
                                {errors.label && <p className="text-red-500 text-xs mt-1">{errors.label}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key (Identificador único)</label>
                                <input
                                    type="text"
                                    value={data.key}
                                    onChange={e => setData('key', e.target.value)}
                                    className="w-full border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                                    placeholder="Ej. estado_llantas"
                                    required
                                />
                                {errors.key && <p className="text-red-500 text-xs mt-1">{errors.key}</p>}
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Orden</label>
                                    <input
                                        type="number"
                                        value={data.order}
                                        onChange={e => setData('order', e.target.value)}
                                        className="w-full border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                        required
                                    />
                                </div>
                                <div className="flex flex-col justify-end pb-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={data.active}
                                            onChange={e => setData('active', e.target.checked)}
                                            className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Activo</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    {processing ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </LeaderLayout>
    );
}
