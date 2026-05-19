---
name: refresh-gares-data
description: Vérifier la fraîcheur de l'asset des gares SNCF (`public/data/gares-sncf.geojson`) et proposer d'exécuter la pipeline de refresh `node scripts/fetch-gares-sncf.mjs` avant un commit, un tag de version, une release ou un déploiement du projet RefugesInfoApp. À déclencher dès que l'utilisateur évoque un commit, un push, une release, un tag, un déploiement, une mise en prod, ou qu'il modifie le pipeline de fetch des gares ou les types/composants liés à `sncf_gare`. Cette donnée est figée en commit (pas régénérée au build), donc si elle est ancienne, les utilisateurs finals voient une liste de gares périmée. Ne PAS lancer la pipeline automatiquement — toujours demander confirmation au préalable.
---

# Refresh des données gares SNCF avant commit

## Contexte du projet

RefugesInfoApp est une app statique (Astro SSG sur Netlify). Le fichier `public/data/gares-sncf.geojson` est un **asset commité dans le dépôt**, pas régénéré au build Netlify. Il contient 2782 gares de voyageurs SNCF récupérées depuis l'export officiel data.gouv.fr / ressources.data.sncf.com.

**Le dataset source SNCF est mis à jour quotidiennement**, mais notre asset local lui ne bouge que quand quelqu'un lance la pipeline. Sans refresh régulier, l'app sert progressivement des données obsolètes : gares fermées, nouvelles ouvertures, libellés modifiés.

## Quand intervenir

Active cette vérification dans ces situations :

1. **L'utilisateur s'apprête à committer** quoi que ce soit dans ce projet — propose la vérif si l'asset est ancien (>90 jours).
2. **L'utilisateur prépare une release, un tag de version, ou un déploiement** — refresh recommandé même si l'asset n'a "que" 30 jours, parce qu'on veut shipper de la donnée fraîche.
3. **L'utilisateur a touché à `scripts/fetch-gares-sncf.mjs`**, à `src/lib/transports-api.ts`, au type `sncf_gare` dans `src/lib/types.ts`, ou à toute logique liée — refresh obligatoire pour valider que le pipeline produit toujours un output cohérent.
4. **L'utilisateur demande explicitement** "refresh les gares", "regénère l'asset SNCF", "update gares-sncf.geojson" ou équivalent — exécute la pipeline.

## Procédure

### Étape 1 — Vérifier la fraîcheur

Lis le champ `metadata.generated_at` au début du fichier `public/data/gares-sncf.geojson`. Le fichier commence par un objet `metadata` avant la liste des features, donc un `head` suffit :

```bash
head -c 600 public/data/gares-sncf.geojson
```

Tu y verras une ligne du genre `"generated_at":"2026-05-19T10:08:36.234Z"`. Calcule l'âge à partir de cette date et de la date courante.

Alternative plus simple (mais moins précise) : la date de modif du fichier sur le disque :

```bash
stat -f "%Sm" -t "%Y-%m-%d" public/data/gares-sncf.geojson
```

### Étape 2 — Décider de proposer ou non

| Contexte | Âge < 30j | Âge 30-90j | Âge > 90j |
|---|---|---|---|
| Commit ordinaire | Rien à signaler | Mention discrète | **Proposer le refresh** |
| Release / tag / deploy | Mention | **Proposer** | **Proposer fortement** |
| Modif du pipeline lui-même | **Toujours regénérer pour valider** | idem | idem |

La règle générale : ne pas être lourdingue sur un commit ordinaire avec une donnée récente. Mais ne jamais laisser passer une release avec une donnée de plus de 3 mois en silence.

### Étape 3 — Demander confirmation

Avant de lancer la pipeline, formule la proposition clairement. Exemple :

> L'asset `public/data/gares-sncf.geojson` a été généré le 2026-02-12 (il y a 96 jours). Avant de tagger la version, je propose de relancer la pipeline pour récupérer les éventuelles nouvelles gares. Ça prend ~10 secondes et touche un seul fichier (~423 KB).
>
> Je lance `node scripts/fetch-gares-sncf.mjs` ?

**N'exécute jamais la commande sans confirmation explicite**, même si la donnée est très ancienne. Le user peut avoir une raison de geler l'asset (debug, release urgente, contrainte réseau, etc.).

### Étape 4 — Exécuter et intégrer au commit

Si le user confirme :

```bash
node scripts/fetch-gares-sncf.mjs
```

Output attendu :

```
✓ /Users/.../public/data/gares-sncf.geojson
  2782 gares · 422.4 KB
```

Vérifie ensuite ce qui a changé :

```bash
git diff --stat public/data/gares-sncf.geojson
```

- Si le diff est vide → tout est à jour, pas besoin d'ajouter le fichier au commit.
- Si le diff est non trivial (>100 lignes) → c'est un refresh légitime, ajoute le fichier au commit en cours **avec un message dédié** ou en mention dans le message principal. Ne mélange pas un refresh massif avec un autre commit fonctionnel.

## Garde-fous

- **Ne jamais exécuter la pipeline sans confirmation** (le réseau peut être instable, le service SNCF peut être down, le user peut être en avion).
- **Ne pas bloquer le commit** si le refresh échoue — propose au user de continuer sans refresh et de retenter plus tard.
- **Le nombre de gares attendu est ~2700-2900**. Si le script en retourne <2000 ou >3500, alerte le user : il y a probablement une régression côté source SNCF ou côté pipeline. Ne commit pas un fichier suspect en silence.
- **Ne pas confondre avec d'autres datasets**. Cette skill concerne uniquement `gares-sncf.geojson`. Les sources refuges.info, OSM Overpass et Camptocamp sont fetchées en runtime côté client et ne sont pas concernées.

## Pourquoi cette skill existe

Un asset statique commité peut facilement dériver pendant des mois sans que personne ne le remarque, surtout dans une app où la donnée n'apparaît qu'en option (filtre opt-in dans l'UI). L'objectif est de rendre le refresh **visible et rituel** au moment des commits/releases, pas automatique — pour que le développeur garde la décision mais ne l'oublie pas.
