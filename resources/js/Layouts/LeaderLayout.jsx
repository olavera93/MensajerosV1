import React from 'react';
import { Link, usePage, router } from '@inertiajs/react';

export default function LeaderLayout({ children, title }) {
    const { auth } = usePage().props;

    const menuItems = [
        { label: 'Dashboard', icon: '🏠', route: 'dashboard', active: route().current('dashboard') },
        { label: 'Horarios', icon: '🕒', route: 'shifts.index', active: route().current('shifts.*') },
        { label: 'Preoperacional', icon: '📋', route: 'reports.preoperational', active: route().current('reports.preoperational') },
        { label: 'Aseo', icon: '✨', route: 'reports.cleaning', active: route().current('reports.cleaning') },
        { label: 'Estadísticas', icon: '📊', route: 'reports.global-stats', active: route().current('reports.global-stats') },
        { label: 'Almuerzo', icon: '🍽️', route: 'reports.lunch', active: route().current('reports.lunch') },
        { label: 'Salida', icon: '🏁', route: 'reports.exit', active: route().current('reports.exit') },
        { label: 'Formularios', icon: '📝', route: 'external-forms.index', active: route().current('external-forms.*') },
        { label: 'Mensajeros', icon: '🛵', route: 'messengers.index', active: route().current('messengers.*') },
        { label: 'Trámites', icon: '💼', route: 'procedures.index', active: route().current('procedures.*') },
        { label: 'Eventos', icon: '📌', route: 'events.index', active: route().current('events.*') },
        { label: 'Usuarios', icon: '👤', route: 'users.index', active: route().current('users.*') },
    ].filter(item => {
        // Administrador tiene acceso a todo (igual que el backend)
        if (auth.user.role === 'administrador') return true;

        // Para los demás roles, el acceso es dinámico por módulos asignados
        return auth.user.modules && auth.user.modules.includes(item.route);
    });

    // Customize bottom nav items based on role
    let bottomNavItems = [];
    if (auth.user.role === 'administrador') {
        bottomNavItems = [
            menuItems.find(i => i.route === 'dashboard'),
            menuItems.find(i => i.route === 'shifts.index'),
            menuItems.find(i => i.route === 'messengers.index'),
        ].filter(Boolean);
    } else {
        bottomNavItems = menuItems.slice(0, 4);
    }

    const logout = (e) => {
        e.preventDefault();
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
                    <Link href={route('dashboard')} className="font-black text-base sm:text-xl tracking-tight text-indigo-400">
                        LOGÍSTICA <span className="text-white">LFH</span>
                    </Link>

                    {/* Desktop Links */}
                    <div className="hidden lg:flex items-center gap-1">
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
                                flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold tracking-wide transition-all duration-200 active:scale-95
                                ${nav.active
                                    ? 'text-indigo-400'
                                    : 'text-slate-500 hover:text-slate-300'}
                            `}
                        >
                            <span className={`text-lg leading-none transition-transform duration-200 ${nav.active ? 'scale-110' : ''}`}>
                                {nav.icon}
                            </span>
                            <span>{nav.label}</span>
                            {nav.active && (
                                <span className="absolute top-1 w-1 h-1 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                            )}
                        </Link>
                    ))}
                    {/* Botón Salir para móvil */}
                    <button
                        onClick={logout}
                        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold tracking-wide transition-all duration-200 active:scale-95 text-slate-500 hover:text-red-400"
                    >
                        <span className="text-lg leading-none">🚪</span>
                        <span>Salir</span>
                    </button>
                </div>
            </nav>
        </div>
    );
}
