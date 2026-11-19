import React from 'react';
import { Link, usePage, router } from '@inertiajs/react';

export default function LeaderLayout({ children, title }) {
    const { auth } = usePage().props;

    // Menú: los módulos que el usuario puede ver (catálogo compartido por el servidor)
    const permissions = auth.user.permissions || [];
    const menuItems = (auth.menu || [])
        .filter(g => permissions.includes(`${g.key}.ver`))
        .map(g => ({
            label: g.label,
            icon: g.icon,
            route: g.route,
            active: route().current(g.route.replace(/\.index$/, '') + '*'),
        }));

    // Barra inferior en móvil: hasta cuatro módulos; si hay más, el cuarto espacio es "Más",
    // que abre el menú completo (todos los módulos, usuario y salir)
    const hasMore = menuItems.length > 4;
    const bottomNavItems = hasMore ? menuItems.slice(0, 3) : menuItems;
    const activeInMore = hasMore && menuItems.slice(3).some(n => n.active);
    const [showMenu, setShowMenu] = React.useState(false);

    const logout = (e) => {
        e.preventDefault();
        // Borra cualquier copia guardada por el service worker antes de salir
        if ('caches' in window) {
            caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => { });
        }
        router.post(route('logout'));
    };

    const [theme, setTheme] = React.useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') || 'light';
        }
        return 'light';
    });

    React.useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-sm selection:bg-indigo-100 dark:selection:bg-indigo-900">
            {/* Top Navigation Bar */}
            <nav className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-[2000]">
                <div className="max-w-[1800px] mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
                    {/* Brand */}
                    <Link href={route(menuItems[0]?.route ?? 'landing')} className="font-black text-base sm:text-xl tracking-tight text-indigo-400">
                        LOGÍSTICA <span className="text-white">LFH</span>
                    </Link>

                    {/* Desktop Links */}
                    <div className="hidden lg:flex items-center gap-1 min-w-0 overflow-x-auto mx-4">
                        {menuItems.map((nav) => (
                            <Link
                                key={nav.route}
                                href={route(nav.route)}
                                className={`
                                    px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200
                                    ${nav.active
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                                `}
                            >
                                {nav.label}
                            </Link>
                        ))}
                    </div>

                    {/* Right side controls */}
                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* User name - desktop only */}
                        <div className="hidden sm:flex flex-col items-end mr-2">
                            <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Usuario</span>
                            <span className="text-xs font-bold text-white">{auth.user.name}</span>
                        </div>

                        {/* Logout - desktop only */}
                        <button
                            onClick={logout}
                            className="hidden md:block bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors duration-200"
                        >
                            Salir
                        </button>

                        {/* Theme Toggle */}
                        <div className="flex items-center bg-slate-800 rounded-full p-1 border border-slate-700">
                            <button
                                onClick={() => setTheme('light')}
                                className={`p-1.5 rounded-full transition-colors ${theme === 'light' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                title="Modo Día"
                            >
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                title="Modo Oscuro"
                            >
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content — padded on mobile for bottom nav */}
            <main className="pb-20 lg:pb-0">
                {children}
            </main>

            {/* ── Bottom Nav Bar (Mobile Only) ── */}
            <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[2000] bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 safe-area-inset-bottom">
                <div className="flex items-stretch h-16">
                    {bottomNavItems.map((nav) => (
                        <Link
                            key={nav.route}
                            href={route(nav.route)}
                            className={`
                                relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold tracking-wide transition-all duration-200 active:scale-95
                                ${nav.active
                                    ? 'text-indigo-400'
                                    : 'text-slate-500 hover:text-slate-300'}
                            `}
                        >
                            <span className={`text-lg leading-none transition-transform duration-200 ${nav.active ? 'scale-110' : ''}`}>
                                {nav.icon}
                            </span>
                            <span className="max-w-full truncate px-1">{nav.label}</span>
                            {nav.active && (
                                <span className="absolute top-1 w-1 h-1 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                            )}
                        </Link>
                    ))}
                    {/* Menú completo en móvil */}
                    <button
                        type="button"
                        onClick={() => setShowMenu(true)}
                        aria-label="Abrir menú"
                        className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold tracking-wide transition-all duration-200 active:scale-95 ${activeInMore ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <span className="text-lg leading-none">☰</span>
                        <span>Más</span>
                        {activeInMore && <span className="absolute top-1 w-1 h-1 bg-indigo-400 rounded-full" />}
                    </button>
                </div>
            </nav>

            {/* ── Menú completo (móvil) ── */}
            {showMenu && (
                <div className="lg:hidden fixed inset-0 z-[2100]" role="dialog" aria-modal="true">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowMenu(false)} />
                    <div className="absolute bottom-0 inset-x-0 max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl pb-[env(safe-area-inset-bottom)]">
                        <div className="sticky top-0 bg-white dark:bg-slate-900 px-5 pt-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="mx-auto w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mb-3" />
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Usuario</p>
                                    <p className="font-bold text-slate-800 dark:text-white truncate">{auth.user.name}</p>
                                </div>
                                <button type="button" onClick={() => setShowMenu(false)} className="shrink-0 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold" aria-label="Cerrar menú">✕</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-4">
                            {menuItems.map((nav) => (
                                <Link
                                    key={nav.route}
                                    href={route(nav.route)}
                                    onClick={() => setShowMenu(false)}
                                    className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-center text-[11px] font-bold leading-tight transition-colors ${nav.active
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 active:bg-slate-100'}`}
                                >
                                    <span className="text-2xl leading-none">{nav.icon}</span>
                                    <span>{nav.label}</span>
                                </Link>
                            ))}
                        </div>
                        <div className="px-4 pb-4 space-y-2">
                            <button
                                type="button"
                                onClick={logout}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white py-3 text-xs font-bold"
                            >
                                🚪 Salir
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
