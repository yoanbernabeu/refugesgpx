import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export function LoadingBadge() {
  const isLoadingPois = useAppStore((s) => s.isLoadingPois);
  const isLoadingAnnex = useAppStore((s) => s.isLoadingAnnex);

  if (!isLoadingPois && !isLoadingAnnex) return null;

  const sources: string[] = [];
  if (isLoadingPois) sources.push('refuges.info');
  if (isLoadingAnnex) sources.push('OSM / Camptocamp');
  const label = `Chargement ${sources.join(' + ')}…`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2"
    >
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-md backdrop-blur">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-accent)]" aria-hidden />
        <span>{label}</span>
      </div>
    </div>
  );
}
