import { RotateCcw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { traceLengthKm, traceElevationStats } from '@/lib/geo';

/** Bandeau ultra-compact : nom de la trace en truncate sur 1 ligne, stats
 * en dessous en petits caractères, bouton reset en icône à droite.
 * Pensé pour libérer un maximum de hauteur pour la liste des POIs. */
export function TraceInfo() {
  const trace = useAppStore((s) => s.trace);
  const reset = useAppStore((s) => s.reset);

  if (!trace) return null;

  const km = traceLengthKm(trace).toFixed(1);
  const elev = traceElevationStats(trace);

  return (
    <div className="flex items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1.5">
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-sm font-semibold leading-tight text-slate-900"
          title={trace.name}
        >
          {trace.name}
        </div>
        <div className="truncate text-[11px] leading-tight text-slate-600">
          <b className="text-blue-700">{km} km</b>
          {elev.ascent > 0 && (
            <>
              {' '}· <b className="text-blue-700">{elev.ascent} D+</b>
              {' / '}<b className="text-blue-700">{elev.descent} D−</b>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={reset}
        title="Charger une autre trace"
        className="shrink-0 rounded p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
