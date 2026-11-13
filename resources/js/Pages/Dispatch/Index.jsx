import React from 'react';
import { Head, useForm } from '@inertiajs/react';
import csrfHeaders from '@/utils/csrf';

export default function DispatchIndex({ locations, messengers }) {
    const { data, setData, post, processing, errors } = useForm({
        file: null,
        location_id: '',
        messenger_id: '',
        last_route: false,
        output_name: '',
    });

    const submit = (e) => {
        e.preventDefault();

        // For file downloads, standard Inertia post might try to parse JSON.
        // But let's try standard submit if we want to trigger download.
        // Actually, Inertia documentation suggests using a normal anchor for GET downloads.
        // For POST downloads (form submission), we can handle it via Inertia but ignoring the response?
        // Or simply use a native HTML form submit to avoid Inertia 409 issues with binary responses.

        // Let's use native form submission for simplicity and robustness with file downloads.
        const formData = new FormData();
        formData.append('file', data.file);
        formData.append('location_id', data.location_id);
        formData.append('messenger_id', data.messenger_id);
        formData.append('last_route', data.last_route ? '1' : '0');
        formData.append('output_name', data.output_name);

        // Native submit
        fetch(route('dispatch.store'), {
            method: 'POST',
            body: formData,
            headers: csrfHeaders(),
        })
            .then(response => {
                if (response.ok) {
                    return response.blob();
                }
                throw new Error('Error generating file');
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${data.output_name}.xlsx`; // or extract from headers
                document.body.appendChild(a);
                a.click();
                a.remove();
            })
            .catch(error => {
                alert('Error al generar el archivo. Verifica los datos.');
                console.error(error);
            });
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
            <Head title="Generador de Rutas" />

            <div className="max-w-4xl mx-auto">
                <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-8 border-b pb-4 dark:border-gray-700">
                        📁 Generador de Archivos de Despacho
                    </h1>

                    <form onSubmit={submit} className="space-y-6">
                        {/* File Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Archivo Excel Original
                            </label>
                            <input
                                type="file"
                                onChange={(e) => setData('file', e.target.files[0])}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                accept=".xlsx, .xls"
                                required
                            />
                            {errors.file && <p className="text-red-500 text-xs mt-1">{errors.file}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Location */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Bodega (Ubicación)
                                </label>
                                <select
                                    value={data.location_id}
                                    onChange={(e) => setData('location_id', e.target.value)}
                                    className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm"
                                    required
                                >
                                    <option value="">Seleccionar Bodega...</option>
                                    {locations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>
                                            {loc.name} - {loc.prefix}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Messenger */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Mensajero / Vehículo
                                </label>
                                <select
                                    value={data.messenger_id}
                                    onChange={(e) => setData('messenger_id', e.target.value)}
                                    className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm"
                                    required
                                >
                                    <option value="">Seleccionar Mensajero...</option>
                                    {messengers.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} ({m.vehicle || 'Sin Placa'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Options */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Nombre del Archivo de Salida
                                </label>
                                <input
                                    type="text"
                                    value={data.output_name}
                                    onChange={(e) => setData('output_name', e.target.value)}
                                    className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm"
                                    placeholder="Ej: ruta_bodega1_final"
                                    required
                                />
                            </div>

                            <div className="flex items-center space-x-3 pt-6">
                                <input
                                    type="checkbox"
                                    checked={data.last_route}
                                    onChange={(e) => setData('last_route', e.target.checked)}
                                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 h-5 w-5"
                                />
                                <span className="text-gray-700 dark:text-gray-300 font-medium">Es última ruta? (No genera retorno)</span>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="pt-6">
                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                            >
                                {processing ? 'Procesando...' : '🚀 Generar Archivo Excel'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="mt-8 text-center">
                    <a href={route('dashboard')} className="text-indigo-600 hover:text-indigo-800 font-medium underline">
                        &larr; Volver al Dashboard (Control de Almuerzos)
                    </a>
                </div>
            </div>
        </div>
    );
}
