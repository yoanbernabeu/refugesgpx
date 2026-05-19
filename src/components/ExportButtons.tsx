import { Download, Printer } from 'lucide-react';
import { Button } from './ui/Button';
import { useAppStore } from '@/store/useAppStore';
import { buildEnrichedGpx, downloadFile, slugify } from '@/lib/exports';

const PRINT_STORAGE_KEY = 'refuges-print-payload';

export function ExportButtons() {
  const trace = useAppStore((s) => s.trace);
  const candidates = useAppStore((s) => s.candidates);
  const annexCandidates = useAppStore((s) => s.annexCandidates);
  const selectedIds = useAppStore((s) => s.selectedIds);

  if (!trace) return null;

  const selectedCandidates = [...candidates, ...annexCandidates].filter((c) =>
    selectedIds.has(c.id),
  );
  const hasSel = selectedCandidates.length > 0;
  const n = selectedCandidates.length;

  const handleGpx = () => {
    const gpx = buildEnrichedGpx(trace, selectedCandidates);
    downloadFile(`${slugify(trace.name)}_enrichi.gpx`, gpx, 'application/gpx+xml');
  };

  const handlePrint = () => {
    const payload = {
      trace,
      pois: selectedCandidates.map((c) => ({
        feature: c.feature,
        distM: c.distM,
        source: c.source,
      })),
    };
    sessionStorage.setItem(PRINT_STORAGE_KEY, JSON.stringify(payload));
    window.open('/print', '_blank');
  };

  // 2 boutons côte à côte en grid pour minimiser la hauteur verticale.
  // L'indicateur "0 POI" est affiché en intra-bouton plutôt que comme texte
  // séparé, pour rester compact.
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="primary"
        onClick={handleGpx}
        disabled={!hasSel}
        title={hasSel ? `Exporter ${n} POI(s) en GPX` : 'Cocher au moins un POI'}
      >
        <Download className="h-3.5 w-3.5" />
        GPX{hasSel ? ` (${n})` : ''}
      </Button>
      <Button
        variant="outline"
        onClick={handlePrint}
        disabled={!hasSel}
        title={hasSel ? 'Ouvrir le topo PDF imprimable' : 'Cocher au moins un POI'}
      >
        <Printer className="h-3.5 w-3.5" />
        Topo PDF
      </Button>
    </div>
  );
}

export { PRINT_STORAGE_KEY };
