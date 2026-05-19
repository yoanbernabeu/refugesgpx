---
name: refresh-datatourisme-data
description: Vérifier la fraîcheur de l'asset hébergements DATAtourisme (`public/data/datatourisme-lodging/`) et proposer d'exécuter la pipeline de refresh `node scripts/fetch-datatourisme.mjs` avant un commit, un tag de version, une release ou un déploiement du projet RefugesInfoApp. À déclencher dès que l'utilisateur évoque un commit, un push, une release, un tag, un déploiement, une mise en prod, ou qu'il modifie le pipeline de fetch DATAtourisme ou les types/composants liés à `dt_lodging`. Cette donnée est figée en commit (pas régénérée au build), donc si elle est ancienne, les utilisateurs finals voient une liste d'hébergements obsolète. Volume conséquent (~41 MB commité, 98 fichiers + index.json), donc à ne pas régénérer à chaque commit ordinaire — réserver pour les vraies releases. Ne PAS lancer la pipeline automatiquement — toujours demander confirmation au préalable.
---

# Refresh des données hébergements DATAtourisme avant commit

## Contexte du projet

RefugesInfoApp est une app statique (Astro SSG sur Netlify). Les hébergements DATAtourisme vivent dans `public/data/datatourisme-lodging/` sous la forme d'un fichier `index.json` + un fichier GeoJSON par département (`73.geojson` pour Savoie, `2A.geojson` pour Corse-du-Sud, etc.). Volume total commité : **~41 MB pour ~128 000 hébergements**.

Le dataset source DATAtourisme (ADN Tourisme) est régénéré tous les jours à 3h du matin, agrégeant les contributions des offices de tourisme. Notre asset local ne bouge que quand quelqu'un lance la pipeline.

**Particularité importante** : le refresh télécharge ~400 MB de CSV en amont depuis data.gouv.fr et prend **3 à 5 minutes**. Ce n'est pas une opération à banaliser.

## Quand intervenir

Active cette vérification dans ces situations :

1. **L'utilisateur prépare une release, un tag de version, ou un déploiement** — c'est le moment principal. On veut shipper de la donnée fraîche.
2. **L'utilisateur a touché à `scripts/fetch-datatourisme.mjs`**, à `src/lib/datatourisme-api.ts`, au type `dt_lodging` dans `src/lib/types.ts`, ou à la taxonomie `DT_SUBTYPE_LABEL` / `LODGING_URIS` — refresh obligatoire pour valider que le pipeline produit toujours un output cohérent.
3. **L'utilisateur demande explicitement** "refresh les hébergements", "regénère DATAtourisme", "update datatourisme-lodging" ou équivalent — exécute la pipeline.
4. **L'utilisateur s'apprête à committer** un autre changement non-trivial alors que l'asset a plus de 6 mois — mention discrète seulement, pas de blocage.

Sur un commit ordinaire avec un asset récent, **ne rien dire**. Cette pipeline coûte du temps (download + parsing) et touche beaucoup de fichiers — pas raisonnable d'en faire un rituel à chaque commit.

## Procédure

### Étape 1 — Vérifier la fraîcheur

Lis le champ `generated_at` dans l'index :

```bash
python3 -c "import json; print(json.load(open('public/data/datatourisme-lodging/index.json'))['generated_at'])"
```

Ou plus simplement la date de modif :

```bash
stat -f "%Sm" -t "%Y-%m-%d" public/data/datatourisme-lodging/index.json
```

### Étape 2 — Décider de proposer ou non

| Contexte | Âge < 90j | Âge 90-180j | Âge > 180j |
|---|---|---|---|
| Commit ordinaire | Rien à signaler | Rien à signaler | Mention discrète |
| Release / tag / deploy | Mention | **Proposer** | **Proposer fortement** |
| Modif du pipeline ou de la taxonomie | **Toujours regénérer** | idem | idem |

Le seuil est plus laxiste que pour les gares parce que :
- Le volume change moins vite côté DATAtourisme (les offices de tourisme ne mettent pas à jour quotidiennement leurs fiches).
- Le coût de refresh est élevé (~5 min, 400 MB téléchargés, 98 fichiers modifiés).

### Étape 3 — Demander confirmation

Avant de lancer la pipeline, prévenir clairement l'utilisateur du coût :

> L'asset DATAtourisme a été généré le 2026-01-15 (il y a 124 jours). Avant de tagger la version, je peux relancer la pipeline pour récupérer les nouveaux hébergements. **Attention : ça télécharge ~400 MB de CSV depuis data.gouv.fr, prend 3 à 5 minutes, et modifie ~98 fichiers (un par département)**.
>
> Je lance `node scripts/fetch-datatourisme.mjs` ?

**N'exécute jamais la commande sans confirmation explicite**. Le coût est plus important que pour les gares, et le user peut avoir une raison de différer (réseau lent, branche WIP, contrainte de timing).

### Étape 4 — Exécuter et intégrer au commit

Si le user confirme :

```bash
node scripts/fetch-datatourisme.mjs
```

Le script affiche le détail par région + le top 5 des départements les plus volumineux à la fin. Output typique :

```
✓ 98 départements · 128513 hébergements · 40.56 MB total
```

Vérifie ensuite ce qui a changé :

```bash
git status public/data/datatourisme-lodging/
git diff --stat public/data/datatourisme-lodging/index.json
```

Le diff sur `index.json` est le plus informatif : il montre l'évolution du count par dept, et donc si la mise à jour est plausible.

- Si le diff sur l'index est **vide** → tout est à jour. Les fichiers dept peuvent quand même bouger (re-tri JSON), pas grave.
- Si le diff sur l'index montre des comptes très différents (±50% sur plusieurs depts) → **alerte le user** : il y a probablement un changement upstream à investiguer.
- Sinon → c'est un refresh légitime, ajoute le dossier au commit en cours **avec un message dédié** ou en mention dans le message principal. Un refresh massif (~40 MB) ne devrait pas être mélangé avec un commit fonctionnel.

## Garde-fous

- **Ne jamais exécuter la pipeline sans confirmation** — le coût est non négligeable.
- **Le nombre d'hébergements attendu est ~120 000 à 140 000**. Si le script en retourne <80 000 ou >180 000, alerte le user : il y a probablement une régression côté source ou côté pipeline.
- **Le nombre de départements attendu est ~95-100** (métropole + DOM). Si <90 ou >110, idem alerte.
- **Ne pas commit si le réseau a échoué partiellement** : le script écrit `ERR …` dans le `per_region` de l'index pour les régions qui ont planté. Vérifier qu'aucune région n'est en erreur avant de commit. Si une région a échoué, relancer le script (les autres seront cachées via le `data.gouv.fr/api/1/datasets/r/` qui est stable).
- **Ne pas confondre avec d'autres datasets**. Cette skill concerne uniquement `datatourisme-lodging/`. Les gares SNCF sont gérées par la skill `refresh-gares-data`.

## Pourquoi cette skill existe

Un asset statique de 41 MB commité dans le repo, c'est un cas particulier qu'il faut gérer avec soin. Si on refresh sans réfléchir, on alourdit l'historique git inutilement. Si on oublie de refresh, on shippe en prod une donnée qui peut avoir 6 mois ou plus.

L'objectif est de rendre le refresh **conscient et rituel au moment des vraies releases** — pas un automatisme, pas un oubli. Le développeur garde la décision mais sait quand et pourquoi le faire.
