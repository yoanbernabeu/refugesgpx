import type { ParsedGpx, TrackPoint } from './types';

/**
 * Parser GPX léger basé sur DOMParser natif.
 * Accepte les `<trkpt>` et `<rtept>`. Concatène tous les segments.
 */
export function parseGpx(xmlText: string): ParsedGpx {
  if (typeof window === 'undefined') {
    throw new Error('parseGpx ne fonctionne que côté navigateur (DOMParser requis)');
  }
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('XML invalide');
  }

  const nameNode =
    doc.querySelector('trk > name') ??
    doc.querySelector('metadata > name') ??
    doc.querySelector('rte > name');
  const name = nameNode?.textContent?.trim() || 'Trace sans nom';

  const ptNodes = Array.from(doc.querySelectorAll('trkpt, rtept'));
  const points: TrackPoint[] = ptNodes
    .map((p) => {
      const lat = parseFloat(p.getAttribute('lat') ?? '');
      const lon = parseFloat(p.getAttribute('lon') ?? '');
      const eleStr = p.querySelector('ele')?.textContent;
      const ele = eleStr ? parseFloat(eleStr) : undefined;
      return { lat, lon, ele };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  if (points.length < 2) {
    throw new Error('Aucun tracé exploitable dans ce fichier (< 2 points).');
  }

  return { name, points };
}
