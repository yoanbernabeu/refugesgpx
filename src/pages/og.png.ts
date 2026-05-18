import type { APIRoute } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs/promises';
import path from 'node:path';

export const prerender = true;

const fontsDir = path.resolve(process.cwd(), 'src/assets/fonts');

const COLORS = {
  paper: '#FAF7F0',
  ink: '#1A1A1A',
  inkSoft: '#3A3733',
  accent: '#B85C38',
  trail: '#DDA853',
  moss: '#5E6F4A',
  sky: '#2C7DA0',
  purple: '#6F4E8E',
};

interface VNode {
  type: string;
  props: { style?: Record<string, unknown>; children?: unknown };
}

function el(type: string, style: Record<string, unknown> | null, ...children: unknown[]): VNode {
  return {
    type,
    props: {
      style: style ?? {},
      children: children.length === 0 ? undefined : children.length === 1 ? children[0] : children,
    },
  };
}

const col = (style: Record<string, unknown>, ...children: unknown[]) =>
  el('div', { display: 'flex', flexDirection: 'column', ...style }, ...children);
const row = (style: Record<string, unknown>, ...children: unknown[]) =>
  el('div', { display: 'flex', flexDirection: 'row', ...style }, ...children);
const txt = (style: Record<string, unknown> | null, content: string) =>
  el('span', style, content);

function colorDot(color: string, label: string) {
  return row(
    { alignItems: 'center', gap: 8 },
    el('div', {
      width: 18,
      height: 18,
      borderRadius: 999,
      backgroundColor: color,
      border: '2px solid #1A1A1A',
    }),
    txt(null, label),
  );
}

export const GET: APIRoute = async () => {
  const [frauncesBuf, publicSansBuf] = await Promise.all([
    fs.readFile(path.join(fontsDir, 'fraunces-700.ttf')),
    fs.readFile(path.join(fontsDir, 'public-sans-500.ttf')),
  ]);

  const tree = col(
    {
      width: '1200px',
      height: '630px',
      justifyContent: 'space-between',
      padding: '64px 72px',
      backgroundColor: COLORS.paper,
      color: COLORS.ink,
      fontFamily: 'Public Sans',
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><circle cx='3' cy='3' r='1.5' fill='%231A1A1A' fill-opacity='0.06'/></svg>\")",
    },
    // Header
    row(
      { alignItems: 'baseline', justifyContent: 'space-between', width: '100%' },
      row(
        { alignItems: 'baseline', fontFamily: 'Fraunces', fontSize: 36, color: COLORS.ink },
        txt(null, 'Refuges'),
        txt({ color: COLORS.accent }, '.'),
        txt(null, 'GPX'),
      ),
      txt(
        { fontSize: 22, color: COLORS.inkSoft, letterSpacing: '0.04em' },
        'refuges.yoandev.co',
      ),
    ),
    // Hero
    col(
      { gap: 24 },
      col(
        {
          fontFamily: 'Fraunces',
          fontSize: 104,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: COLORS.ink,
        },
        txt(null, 'Votre tracé,'),
        row(
          { alignItems: 'baseline', gap: 28 },
          txt({ fontStyle: 'italic', color: COLORS.accent }, 'enrichi'),
          txt(null, 'des refuges'),
        ),
        txt(null, 'du coin.'),
      ),
      txt(
        {
          fontSize: 30,
          lineHeight: 1.35,
          color: COLORS.inkSoft,
          maxWidth: 900,
        },
        "Glissez votre GPX, repartez avec les refuges, cabanes et points d'eau refuges.info à proximité — plus un topo PDF imprimable.",
      ),
    ),
    // Footer
    row(
      { alignItems: 'center', justifyContent: 'space-between', width: '100%' },
      row(
        { alignItems: 'center', gap: 22, color: COLORS.inkSoft, fontSize: 22 },
        colorDot(COLORS.accent, 'Refuges'),
        colorDot(COLORS.moss, 'Cabanes'),
        colorDot(COLORS.purple, 'Gîtes'),
        colorDot(COLORS.sky, "Points d'eau"),
        colorDot(COLORS.trail, 'Passages'),
      ),
      el(
        'div',
        {
          display: 'flex',
          padding: '10px 20px',
          backgroundColor: COLORS.ink,
          color: COLORS.paper,
          borderRadius: 999,
          fontSize: 20,
          fontWeight: 600,
        },
        txt(null, 'Open-source · MIT'),
      ),
    ),
  );

  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Fraunces', data: frauncesBuf, weight: 700, style: 'normal' },
      { name: 'Public Sans', data: publicSansBuf, weight: 500, style: 'normal' },
    ],
  });

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
