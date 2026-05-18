# 🥾 Enrichisseur GPX — Refuges.info

> Web-app desktop qui prend un GPX existant, affiche tous les refuges, cabanes, gîtes et points d'eau de [refuges.info](https://www.refuges.info) à proximité, et exporte un **GPX enrichi** + une **fiche d'étape PDF** imprimable.

🚀 **En ligne** : [refuges.yoandev.co](https://refuges.yoandev.co) *(à venir)*

---

## Pourquoi ?

Les planificateurs grand public (OpenRunner, Komoot, Visorando) ne savent pas afficher les cabanes non gardées, points d'eau et passages délicats — pourtant essentiels pour le randonneur autonome en bivouac.

Cette app **complète** ces outils : tu traces ton parcours là où tu as l'habitude, tu déposes le GPX ici, tu coches les refuges qui t'intéressent (avec accès aux derniers commentaires + photos terrain), et tu repars avec un GPX enrichi prêt à charger dans Komoot/OsmAnd/Gaia/GPS dédié.

## Fonctionnalités V1

- 📂 Import GPX (drag-and-drop ou fichier)
- 📏 Distance paramétrable autour du tracé (100 m à 5 km)
- 🏷️ Filtres par type : refuges, cabanes, gîtes, points d'eau, passages délicats
- 🗺️ Affichage carte (OpenTopoMap) avec POIs emoji
- 📋 Liste latérale triée par distance au tracé
- 📖 Fiche détaillée par POI : équipements, accès, **5 derniers commentaires + photos**
- ✅ Sélection multiple
- 📥 **Export GPX enrichi** : tracé original + waypoints sélectionnés
- 🖨️ **Export PDF imprimable** : fiche d'étape avec carte + détails + commentaires (utilisable offline sur téléphone)

## Stack

- [Astro 6](https://astro.build) (SSG)
- [React 19](https://react.dev) (islands)
- [TypeScript 6](https://www.typescriptlang.org)
- [Tailwind CSS 4](https://tailwindcss.com)
- [MapLibre GL JS 5](https://maplibre.org) + [OpenTopoMap](https://opentopomap.org)
- [Turf.js 7](https://turfjs.org) — calculs géo
- [Zod 4](https://zod.dev) — validation runtime des réponses API
- [Zustand 5](https://zustand-demo.pmnd.rs) — state management
- [Radix UI](https://www.radix-ui.com) — primitives accessibles

**Aucun backend.** Tout tourne dans le navigateur, les requêtes vont directement à l'API publique refuges.info.

## Développement

```bash
git clone https://github.com/yoanbernabeu/refuges-gpx-enricher
cd refuges-gpx-enricher
npm install
npm run dev
```

Puis ouvre [http://localhost:4321](http://localhost:4321).

### Scripts

| Commande | Action |
|---|---|
| `npm run dev` | Serveur de développement Astro |
| `npm run build` | Build statique dans `dist/` |
| `npm run preview` | Preview du build |
| `npm run check` | Vérification TypeScript + Astro |
| `npm run test` | Tests Vitest |
| `npm run format` | Format Prettier |

## Déploiement

L'app est conçue pour [Netlify](https://www.netlify.com) (free tier suffit).
Le fichier [`netlify.toml`](./netlify.toml) configure tout ; un `git push` sur `main` suffit pour déployer.

L'app étant un site statique, elle peut tout aussi bien être servie via Cloudflare Pages, GitHub Pages, Vercel ou n'importe quel hébergeur de fichiers statiques.

## Données & licences

- **Code** : [MIT](./LICENSE)
- **Données** : © [refuges.info](https://www.refuges.info) contributors — [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/)
- **Fond de carte** : [OpenTopoMap](https://opentopomap.org) (CC BY-SA) sur données [OpenStreetMap](https://www.openstreetmap.org/copyright)

Toute donnée affichée ou exportée par cette application reste sous **CC BY-SA 2.0**. L'attribution est visible sur la carte, dans le GPX (`<copyright>`) et dans la fiche PDF générée.

## Crédits

- L'équipe et la communauté de [refuges.info](https://www.refuges.info) pour leur travail extraordinaire d'inventaire collaboratif des refuges et cabanes des massifs français et européens.
- OpenStreetMap et OpenTopoMap pour les fonds de carte libres.

## Contribuer

Les contributions sont bienvenues — ouvre une issue ou une PR. Bug d'API refuges.info ? Voir [`api.md`](./api.md) pour les anomalies déjà identifiées, sinon une issue upstream est probablement la bonne destination.
