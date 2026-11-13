import React, { useState } from 'react';
import Modal from '@/Components/Modal';
import TextInput from '@/Components/TextInput';
import InputLabel from '@/Components/InputLabel';
import SecondaryButton from '@/Components/SecondaryButton';
import axios from 'axios';
import csrfHeaders from '@/utils/csrf';

const TABLES = [
    { key: 'lunch_logs', label: '🍽️ Registros de Almuerzo', desc: 'Registros de inicio/fin de almuerzo por fecha de inicio' },
    { key: 'shift_completions', label: '🏁 Reportes de Salida', desc: 'Cierres de turno por fecha del reporte' },
    { key: 'shifts', label: '📅 Turnos Programados', desc: 'Horarios asignados, por fecha del turno' },
];

export default function DataPurgeModal({ show, onClose }) {
    const [step, setStep] = useState(1);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [tables, setTables] = useState(['lunch_logs', 'shift_completions', 'shifts']);
    const [counts, setCounts] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [backupDownloaded, setBackupDownloaded] = useState(false);
    const [downloadingBackup, setDownloadingBackup] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const resetState = () => {
        setStep(1); setStartDate(''); setEndDate('');
        setTables(['lunch_logs', 'shift_completions', 'shifts']);
        setCounts(null); setBackupDownloaded(false);
        setPassword(''); setPasswordError('');
        setConfirmation(''); setResult(null);
    };

    const handleClose = () => { resetState(); onClose(); };

    const toggleTable = (key) => setTables(prev =>
        prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    );

    // Step 1 → 2: Fetch preview counts
    const handlePreview = async () => {
        setLoadingPreview(true);
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate, ...Object.fromEntries(tables.map((t, i) => [`tables[${i}]`, t])) });
        try {
            const res = await fetch(`${route('admin.purge.preview')}?${params}`);
            const data = await res.json();
            setCounts(data);
            setStep(2);
        } catch (e) {
            alert('Error al obtener previsualizacion. Intenta de nuevo.');
        } finally {
            setLoadingPreview(false);
        }
    };

    // Step 2 → 3: Download backup (mandatory)
    const handleDownloadBackup = async () => {
        setDownloadingBackup(true);
        try {
            const response = await axios.post(route('admin.purge.backup'), {
                start_date: startDate,
                end_date: endDate,
                tables: tables,
            }, {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `respaldo_depuracion_${new Date().toISOString().slice(0, 10)}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            setBackupDownloaded(true);
            setDownloadingBackup(false);
        } catch (e) {
            setDownloadingBackup(false);
            console.error('Download error:', e);
            alert('Error al generar el respaldo. Verifique que la sesión no haya expirado.');
        }
    };

    // Step 3 → 4: Verify password
    const handleVerifyPassword = async () => {
        setLoading(true); setPasswordError('');
        try {
            const res = await fetch(route('admin.purge.verify'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
                body: JSON.stringify({ password }),
            });
            if (res.status === 422) {
                const err = await res.json();
                setPasswordError(err.error || 'Contraseña incorrecta.');
            } else {
                setStep(4);
            }
        } catch (e) {
            setPasswordError('Error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    // Step 4: Execute purge
    const handleExecute = async () => {
        if (confirmation !== 'ELIMINAR') return;
        setLoading(true);
        try {
            const res = await fetch(route('admin.purge.execute'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
                body: JSON.stringify({
                    start_date: startDate, end_date: endDate,
                    tables, password, confirmation: 'ELIMINAR'
                }),
            });
            const data = await res.json();
            if (data.success) {
                setResult(data);
                setStep(5);
            } else {
                alert(data.error || 'Error al eliminar.');
            }
        } catch (e) {
            alert('Error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    const tableLabel = (key) => TABLES.find(t => t.key === key)?.label ?? key;
    const totalCount = counts ? counts.total : 0;

    return (
        <Modal show={show} onClose={handleClose} maxWidth="lg">
            <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🗑️</span>
                        <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Depurar Base de Datos</h2>
                    </div>
                    {/* Step indicator */}
                    {step < 5 && (
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4].map(s => (
                                <div key={s} className={`w-6 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                            ))}
                        </div>
                    )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                    {['', 'Selecciona el rango y las tablas a limpiar.', 'Revisa los registros afectados y descarga el respaldo.', 'Verifica tu identidad.', 'Confirmación final antes de eliminar.', ''][step]}
                </p>

                {/* ─── STEP 1: Config ──────────────────────────────────────────────── */}
                {step === 1 && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <InputLabel value="Desde" />
                                <TextInput type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full mt-1" />
                            </div>
                            <div>
                                <InputLabel value="Hasta" />
                                <TextInput type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full mt-1" />
                            </div>
                        </div>

                        <div>
                            <InputLabel value="Tablas a depurar" className="mb-2" />
                            <div className="space-y-2 mt-2">
                                {TABLES.map(t => (
                                    <label key={t.key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${tables.includes(t.key) ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                        <input type="checkbox" checked={tables.includes(t.key)} onChange={() => toggleTable(t.key)}
                                            className="mt-0.5 accent-red-500 w-4 h-4 shrink-0" />
                                        <div>
                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{t.label}</div>
                                            <div className="text-xs text-slate-400">{t.desc}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <SecondaryButton onClick={handleClose}>Cancelar</SecondaryButton>
                            <button
                                disabled={!startDate || !endDate || tables.length === 0 || loadingPreview}
                                onClick={handlePreview}
                                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                                {loadingPreview ? <span className="animate-spin">⏳</span> : '🔍'} Ver Afectados →
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── STEP 2: Preview + Mandatory Backup ──────────────────────────── */}
                {step === 2 && counts && (
                    <div className="space-y-5">
                        <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4">
                            <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest mb-3">Registros a eliminar</p>
                            <div className="space-y-2">
                                {tables.map(t => (
                                    <div key={t} className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600 dark:text-slate-300">{tableLabel(t)}</span>
                                        <span className="font-mono font-black text-slate-800 dark:text-white">{(counts.counts?.[t] ?? 0).toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="border-t border-orange-200 dark:border-orange-700 pt-2 mt-2 flex items-center justify-between">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Total</span>
                                    <span className="font-mono font-black text-red-600 dark:text-red-400 text-lg">{totalCount.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Mandatory backup */}
                        <div className={`rounded-xl border-2 p-4 transition-colors ${backupDownloaded ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'}`}>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                                {backupDownloaded ? '✅ Respaldo descargado' : '⚠️ Debes descargar el respaldo antes de continuar'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                Archivo Excel con los {totalCount} registros distribuidos en hojas separadas.
                            </p>
                            <button
                                onClick={handleDownloadBackup}
                                disabled={downloadingBackup}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${backupDownloaded ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'} disabled:opacity-50`}
                            >
                                {downloadingBackup ? <span className="animate-spin">⏳</span> : '⬇️'} {backupDownloaded ? 'Descargar de nuevo' : 'Descargar Respaldo (.xlsx)'}
                            </button>
                        </div>

                        <div className="flex justify-between gap-3 pt-2">
                            <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">← Atrás</button>
                            <div className="flex gap-3">
                                <SecondaryButton onClick={handleClose}>Cancelar</SecondaryButton>
                                <button
                                    disabled={!backupDownloaded}
                                    onClick={() => setStep(3)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors"
                                >
                                    Continuar →
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── STEP 3: Password ────────────────────────────────────────────── */}
                {step === 3 && (
                    <div className="space-y-5">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 text-center">
                            <div className="text-4xl mb-2">🔐</div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Ingresa tu contraseña para continuar</p>
                            <p className="text-xs text-slate-400 mt-1">Esto confirma que eres tú quien autoriza esta acción.</p>
                        </div>

                        <div>
                            <InputLabel value="Contraseña" />
                            <TextInput
                                type="password" value={password}
                                onChange={e => { setPassword(e.target.value); setPasswordError(''); }}
                                placeholder="Tu contraseña de acceso..."
                                className="w-full mt-1"
                                onKeyDown={e => e.key === 'Enter' && password && handleVerifyPassword()}
                            />
                            {passwordError && <p className="text-xs text-red-600 mt-1 font-bold">{passwordError}</p>}
                        </div>

                        <div className="flex justify-between gap-3 pt-2">
                            <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">← Atrás</button>
                            <div className="flex gap-3">
                                <SecondaryButton onClick={handleClose}>Cancelar</SecondaryButton>
                                <button
                                    disabled={!password || loading}
                                    onClick={handleVerifyPassword}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                                >
                                    {loading ? <span className="animate-spin">⏳</span> : '🔓'} Verificar →
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── STEP 4: Final Confirmation ──────────────────────────────────── */}
                {step === 4 && (
                    <div className="space-y-5">
                        <div className="rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-900/20 p-4">
                            <p className="text-sm font-black text-red-700 dark:text-red-400 uppercase tracking-wide mb-2">
                                ⚠️ ACCIÓN IRREVERSIBLE
                            </p>
                            <p className="text-sm text-red-600 dark:text-red-300">
                                Estás a punto de eliminar permanentemente <span className="font-black">{totalCount.toLocaleString()} registros</span> ({tables.map(tableLabel).join(', ')}) del período <span className="font-black">{startDate} → {endDate}</span>.
                            </p>
                            <p className="text-xs text-red-500 dark:text-red-400 mt-2">Esta acción no se puede deshacer. El respaldo descargado es tu única copia.</p>
                        </div>

                        <div>
                            <InputLabel value='Escribe "ELIMINAR" para confirmar' />
                            <TextInput
                                type="text" value={confirmation}
                                onChange={e => setConfirmation(e.target.value)}
                                placeholder="ELIMINAR"
                                className="w-full mt-1 font-mono font-bold tracking-widest"
                            />
                        </div>

                        <div className="flex justify-between gap-3 pt-2">
                            <button onClick={() => setStep(3)} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">← Atrás</button>
                            <button
                                disabled={confirmation !== 'ELIMINAR' || loading}
                                onClick={handleExecute}
                                className="px-5 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-red-500/30"
                            >
                                {loading ? <span className="animate-spin">⏳</span> : '🗑️'} Eliminar Definitivamente
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── STEP 5: Done ────────────────────────────────────────────────── */}
                {step === 5 && result && (
                    <div className="text-center py-4 space-y-4">
                        <div className="text-5xl">✅</div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Depuración completada</h3>
                        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-left space-y-2">
                            {Object.entries(result.deleted || {}).map(([key, count]) => (
                                <div key={key} className="flex justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-300">{tableLabel(key)}</span>
                                    <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">{count.toLocaleString()} eliminados</span>
                                </div>
                            ))}
                            <div className="border-t border-emerald-200 dark:border-emerald-700 pt-2 flex justify-between font-bold">
                                <span className="text-slate-700 dark:text-slate-200">Total</span>
                                <span className="font-mono text-emerald-700 dark:text-emerald-400 text-lg">{result.total?.toLocaleString()}</span>
                            </div>
                        </div>
                        <button onClick={handleClose} className="px-6 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold rounded-lg">
                            Cerrar
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
}
