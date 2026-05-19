import type maplibregl from 'maplibre-gl';

export type BasemapId = 'osm' | 'ign-plan' | 'ign-ortho';

type RasterStyleOpts = {
  sourceId: string;
  tiles: string[];
  maxzoom: number;
  attribution: string;
  tileSize?: number;
};

// Pas de `glyphs` déclaré : les couches POI utilisent des icon-image
// pré-rendues (pas de text-field), donc aucun PBF n'est nécessaire.
function makeRasterStyle(opts: RasterStyleOpts): maplibregl.StyleSpecification {
  const { sourceId, tiles, maxzoom, attribution, tileSize = 256 } = opts;
  return {
    version: 8,
    sources: {
      [sourceId]: {
        type: 'raster',
        tiles,
        tileSize,
        maxzoom,
        attribution,
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#e8f0e3' } },
      { id: sourceId, type: 'raster', source: sourceId },
    ],
  } as unknown as maplibregl.StyleSpecification;
}

// WMTS Géoplateforme IGN (libre, sans clé depuis 2024).
// Doc : https://geoservices.ign.fr/services-web-experts
const IGN_WMTS = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0';
const IGN_ATTRIBUTION =
  'IGN — <a href="https://geoservices.ign.fr/" target="_blank" rel="noopener">Géoplateforme</a>';

function ignTileUrl(layer: string, format: 'image/png' | 'image/jpeg') {
  return (
    `${IGN_WMTS}&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM` +
    `&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=${format}`
  );
}

export const BASEMAPS: Record<
  BasemapId,
  { label: string; style: maplibregl.StyleSpecification }
> = {
  osm: {
    label: 'OpenStreetMap',
    style: makeRasterStyle({
      sourceId: 'osm',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      maxzoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }),
  },
  'ign-plan': {
    label: 'IGN Plan',
    style: makeRasterStyle({
      sourceId: 'ign-plan',
      tiles: [ignTileUrl('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', 'image/png')],
      maxzoom: 18,
      attribution: IGN_ATTRIBUTION,
    }),
  },
  'ign-ortho': {
    label: 'IGN Orthophotos',
    style: makeRasterStyle({
      sourceId: 'ign-ortho',
      tiles: [ignTileUrl('ORTHOIMAGERY.ORTHOPHOTOS', 'image/jpeg')],
      maxzoom: 19,
      attribution: IGN_ATTRIBUTION,
    }),
  },
};

export const DEFAULT_BASEMAP: BasemapId = 'osm';
