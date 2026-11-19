/**
 * Orden de una lista en móvil, donde no se ven los encabezados de la tabla para ordenar.
 * options: [{ key, label }]; sortConfig: { key, direction }; onChange(config).
 */
export default function MobileSort({ options, sortConfig, onChange }) {
    return (
        <div className="sm:hidden flex items-center gap-2 mb-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Ordenar</label>
            <select
                value={sortConfig.key}
                onChange={(e) => onChange({ key: e.target.value, direction: sortConfig.direction })}
                className="flex-1 min-w-0 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-bold py-2"
            >
                {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <button
                type="button"
                onClick={() => onChange({ key: sortConfig.key, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                className="shrink-0 w-10 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-indigo-600"
                aria-label={sortConfig.direction === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
            >
                {sortConfig.direction === 'asc' ? '↑' : '↓'}
            </button>
        </div>
    );
}
