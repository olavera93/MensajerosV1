import React, { useEffect, useState } from 'react';
import { Head, useForm, Link, router } from '@inertiajs/react';

export default function Login({ status, quickLoginUsers }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    // PWA install prompt
    const [installPrompt, setInstallPrompt] = useState(null);
    const [showInstall, setShowInstall] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setInstallPrompt(e);
            setShowInstall(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') setShowInstall(false);
        setInstallPrompt(null);
    };

    useEffect(() => {
        return () => { reset('password'); };
    }, []);

    const submit = (e) => {
        e.preventDefault();
        post(route('login.attempt'));
    };

    const quickLogin = (userId) => {
        router.post(route('login.quick', userId));
    };

    return (
        <div className="min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-slate-50 dark:bg-slate-900">
            <Head title="Ingresar" />

            {/* PWA Install Banner */}
            {showInstall && (
                <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6 flex justify-center">
                    <div className="w-full max-w-md bg-indigo-600 text-white rounded-2xl shadow-2xl flex items-center gap-4 px-5 py-4">
                        <span className="text-3xl shrink-0">📲</span>
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-sm">Instalar Logística LFH</p>
                            <p className="text-indigo-200 text-xs">Accede más rápido desde tu pantalla de inicio</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={handleInstall}
                                className="bg-white text-indigo-600 font-black text-xs uppercase tracking-wider px-4 py-2 rounded-xl hover:bg-indigo-50 active:scale-95 transition-all"
                            >
                                Instalar
                            </button>
                            <button
                                onClick={() => setShowInstall(false)}
                                className="text-indigo-200 hover:text-white p-1 transition-colors"
                                aria-label="Cerrar"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full sm:max-w-md mt-6 px-10 py-12 bg-white dark:bg-slate-800 shadow-2xl rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight">Bienvenido</h1>
                </div>

                {status && <div className="mb-4 font-medium text-sm text-green-600">{status}</div>}

                <form onSubmit={submit} className="space-y-6">
                    <div>
                        <label className="block font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2" htmlFor="email">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            className="block w-full border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-3 transition-all duration-200"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            required
                            autoFocus
                            placeholder="nombre@empresa.com"
                        />
                        {errors.email && <div className="text-red-600 mt-1 text-xs font-bold">{errors.email}</div>}
                    </div>

                    <div className="mt-4">
                        <label className="block font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2" htmlFor="password">
                            Contraseña
                        </label>
                        <input
                            id="password"
                            type="password"
                            className="block w-full border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-3 transition-all duration-200"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                        {errors.password && <div className="text-red-600 mt-1 text-xs font-bold">{errors.password}</div>}
                    </div>

                    <div className="block mt-4">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="rounded border-slate-300 text-indigo-600 shadow-sm focus:ring-indigo-500 h-4 w-4"
                                checked={data.remember}
                                onChange={(e) => setData('remember', e.target.checked)}
                            />
                            <span className="ml-2 text-sm font-medium text-slate-600 dark:text-slate-400">Recordarme</span>
                        </label>
                    </div>

                    <div className="flex items-center justify-end mt-4 pt-4">
                        <button
                            className="w-full inline-flex justify-center items-center px-4 py-3 bg-indigo-600 border border-transparent rounded-xl font-bold text-sm text-white uppercase tracking-widest hover:bg-indigo-700 focus:bg-indigo-700 active:bg-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 transition ease-in-out duration-150 shadow-lg shadow-indigo-500/40"
                            disabled={processing}
                        >
                            INGRESAR
                        </button>
                    </div>
                </form>

                {quickLoginUsers && quickLoginUsers.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-dashed border-amber-300 dark:border-amber-700">
                        <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider font-bold mb-3 text-center">
                            ⚠️ Acceso Rápido (solo entorno local)
                        </p>
                        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                            {quickLoginUsers.map((user) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => quickLogin(user.id)}
                                    className="flex items-center justify-between gap-2 w-full px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 active:scale-95 transition-all duration-150"
                                >
                                    <span className="truncate">{user.name}</span>
                                    <span className="shrink-0 opacity-70 uppercase tracking-tight">{user.role}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-center flex flex-col gap-3">
                    <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">Accesos Rápidos</p>
                    <Link
                        href={route('landing')}
                        className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-slate-800 dark:hover:bg-slate-600 active:scale-95 transition-all duration-150 shadow-md"
                    >
                        <span className="text-lg leading-none">🛵</span>
                        Soy Mensajero
                    </Link>
                </div>
            </div>
        </div>
    );
}
