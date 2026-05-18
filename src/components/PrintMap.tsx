import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { ParsedGpx, PoiFeature } from '@/lib/types';
import { getEmoji } from '@/lib/types';
import { bufferLine, traceBbox, traceToLine } from '@/lib/geo';

interface PrintMapProps {
  trace: ParsedGpx;
  pois: { feature: PoiFeature; distM: number }[];
  /** Largeur en CSS px du canvas (par défaut 720, environ A4 utile) */
  width?: number;
  /** Hauteur CSS du canvas */
  height?: number;
  /** Callback quand la carte a fini de rendre (utile pour déclencher print après) */
  onReady?: () => void;
}

const STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#e8f0e3' } },
    { id: 'osm', type: 'raster', source: 'osm' },
  ],
} as unknown as maplibregl.StyleSpecification;

export function PrintMap({
  trace,
  pois,
  width = 720,
  height = 380,
  onReady,
}: PrintMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      // canvasContextAttributes.preserveDrawingBuffer = indispensable pour capturer
      // le canvas dans le print (sinon le PDF montre un canvas noir).
      canvasContextAttributes: { preserveDrawingBuffer: true },
      attributionControl: false,
      interactive: false,
      fadeDuration: 0,
    });

    map.on('load', () => {
      // Trace + buffer (très léger, juste un repère)
      const line = traceToLine(trace);
      const buf = bufferLine(line, 500);
      map.addSource('trace', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [line, buf] },
      });
      map.addLayer({
        id: 'buf',
        type: 'fill',
        source: 'trace',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#b85c38', 'fill-opacity': 0.08 },
      });
      map.addLayer({
        id: 'line',
        type: 'line',
        source: 'trace',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#b85c38', 'line-width': 3 },
      });

      // POIs sélectionnés
      const features = pois.map(({ feature: f }) => ({
        ...f,
        properties: {
          ...f.properties,
          emoji: getEmoji(f.properties.type?.valeur),
        },
      }));
      map.addSource('pois', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      map.addLayer({
        id: 'poi-dot',
        type: 'circle',
        source: 'pois',
        paint: {
          'circle-radius': 7,
          'circle-color': '#dda853',
          'circle-stroke-color': '#1a1a1a',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'poi-emoji',
        type: 'symbol',
        source: 'pois',
        layout: {
          'text-field': ['get', 'emoji'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 14,
          'text-allow-overlap': true,
        },
      });

      // Fit sur la trace
      const bb = traceBbox(trace);
      map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 30, duration: 0 });

      // Attendre que toutes les tuiles soient idle puis signaler ready
      const onIdle = () => {
        map.off('idle', onIdle);
        setReady(true);
        onReady?.();
      };
      map.on('idle', onIdle);
    });

    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative overflow-hidden rounded border border-[var(--color-paper-deep)] shadow-sm">
      <div
        ref={containerRef}
        style={{ width: `${width}px`, height: `${height}px`, maxWidth: '100%' }}
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-slate-500 no-print">
          Préparation de la carte…
        </div>
      )}
      <div className="absolute bottom-0 right-0 bg-white/80 px-1 text-[8px] text-slate-600">
        © OpenStreetMap contributors · refuges.info CC BY-SA
      </div>
    </div>
  );
}
