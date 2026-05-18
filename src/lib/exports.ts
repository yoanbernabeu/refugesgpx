import type { ParsedGpx, PoiCandidate } from './types';
import { getEmoji } from './types';

function xmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&apos;';
    }
    return c;
  });
}

export function buildEnrichedGpx(
  trace: ParsedGpx,
  selectedPois: PoiCandidate[],
): string {
  const trkpts = trace.points
    .map((p) => {
      const ele = p.ele !== undefined ? `<ele>${p.ele}</ele>` : '';
      return `      <trkpt lat="${p.lat}" lon="${p.lon}">${ele}</trkpt>`;
    })
    .join('\n');

  const wpts = selectedPois
    .map(({ feature: f, distM }) => {
      const props = f.properties;
      const typeValeur = props.type?.valeur ?? '';
      const emoji = getEmoji(typeValeur);
      const name = emoji ? `${emoji} ${props.nom}` : props.nom;
      const alt = props.coord?.alt;
      const ele = alt !== undefined ? `<ele>${alt}</ele>` : '';
      const link = props.lien ? `<link href="${xmlEscape(props.lien)}"/>` : '';
      const desc = `${typeValeur}${
        alt !== undefined ? ' · ' + alt + ' m' : ''
      } · ${Math.round(distM)} m du tracé`;
      return `  <wpt lat="${f.geometry.coordinates[1]}" lon="${f.geometry.coordinates[0]}">
    ${ele}
    <name>${xmlEscape(name)}</name>
    <desc>${xmlEscape(desc)}</desc>
    <type>${xmlEscape(typeValeur)}</type>
    ${link}
  </wpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="refuges-gpx-enricher" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${xmlEscape(trace.name)} (enrichi)</name>
    <desc>Tracé enrichi de ${selectedPois.length} POI(s) refuges.info</desc>
    <copyright author="refuges.info contributors">
      <license>https://creativecommons.org/licenses/by-sa/2.0/</license>
    </copyright>
  </metadata>
${wpts}
  <trk>
    <name>${xmlEscape(trace.name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
