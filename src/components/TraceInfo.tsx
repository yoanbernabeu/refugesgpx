import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { traceLengthKm, traceElevationStats } from '@/lib/geo';
import { Button } from './ui/Button';

export function TraceInfo() {
  const trace = useAppStore((s) => s.trace);
  const reset = useAppStore((s) => s.reset);

  if (!trace) return null;

  const km = traceLengthKm(trace).toFixed(1);
  const elev = traceElevationStats(trace);

  return (
    <div className="rounded-md bg-slate-100 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900 line-clamp-2">{trace.name}</div>
          <div className="text-xs text-slate-600">
            {trace.points.length} pts · <b className="text-blue-700">{km} km</b>
            {elev.ascent > 0 && (
              <>
                {' '}
                · <b className="text-blue-700">{elev.ascent} m D+</b> /{' '}
                <b className="text-blue-700">{elev.descent} m D−</b>
              </>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={reset}
          title="Charger une autre trace"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
