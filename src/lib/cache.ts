/**
 * Cache utilitaire partagé pour les appels API externes, basé sur IndexedDB.
 *
 * Caractéristiques :
 *  - Stockage : IndexedDB → persistant entre sessions, plusieurs centaines de
 *    Mo dispo (vs ~5-10 Mo pour localStorage), pas de cap arbitraire d'entrées.
 *  - API : `readCache` / `writeCache` asynchrones, dégradation gracieuse (renvoient
 *    `null` / no-op en cas d'erreur ou si IndexedDB indispo).
 *  - Eviction : TTL paresseux — une entrée expirée est supprimée à la prochaine
 *    lecture qui la trouve. Pas de scan périodique, on s'en remet à l'usage.
 *  - Bbox : `bboxToGridKey()` arrondit à une grille (~0,02° ≈ 1,5 km) pour
 *    mutualiser les requêtes proches (typiquement quand l'utilisateur slide
 *    le buffer).
 */

const DB_NAME = 'refugesgpx-cache';
const STORE = 'kv';
const DB_VERSION = 2;

interface Entry<T = unknown> {
  ts: number;
  data: T;
}

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Sur upgrade (changement de version), wipe et recrée le store.
      // Évite que d'anciennes entrées d'un format incompatible polluent.
      if (db.objectStoreNames.contains(STORE)) {
        db.deleteObjectStore(STORE);
      }
      db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function fullKey(prefix: string, key: string): string {
  return `${prefix}:${key}`;
}

/**
 * Convertit une bbox (lon/lat) en clé de cache normalisée sur une grille.
 * SW arrondi vers le bas, NE arrondi vers le haut → la bbox d'origine est
 * toujours incluse dans la bbox grid résultante (légèrement plus large).
 */
export function bboxToGridKey(
  bbox: [number, number, number, number],
  step = 0.02,
): string {
  const factor = 1 / step;
  const w = Math.floor(bbox[0] * factor) / factor;
  const s = Math.floor(bbox[1] * factor) / factor;
  const e = Math.ceil(bbox[2] * factor) / factor;
  const n = Math.ceil(bbox[3] * factor) / factor;
  return `${w.toFixed(2)},${s.toFixed(2)},${e.toFixed(2)},${n.toFixed(2)}`;
}

/** Renvoie la bbox grid réelle (un poil plus large) pour la requête API. */
export function gridKeyToBbox(key: string): [number, number, number, number] {
  const [w, s, e, n] = key.split(',').map(Number) as [number, number, number, number];
  return [w, s, e, n];
}

export async function readCache<T>(
  prefix: string,
  key: string,
  ttlMs: number,
): Promise<T | null> {
  try {
    const db = await openDB();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(fullKey(prefix, key));
      req.onsuccess = () => {
        const entry = req.result as Entry<T> | undefined;
        if (!entry) {
          resolve(null);
          return;
        }
        if (Date.now() - entry.ts > ttlMs) {
          // Expiré → on supprime en arrière-plan, on renvoie null
          void deleteEntry(prefix, key);
          resolve(null);
          return;
        }
        resolve(entry.data);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function writeCache<T>(
  prefix: string,
  key: string,
  data: T,
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put({ ts: Date.now(), data }, fullKey(prefix, key));
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    /* best-effort : quota, mode privé, etc. */
  }
}

async function deleteEntry(prefix: string, key: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).delete(fullKey(prefix, key));
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    /* noop */
  }
}

/** TTLs standards utilisés à travers l'app. */
export const TTL = {
  /** Listes par bbox : sources OSM/C2C très stables, mais on garde 24 h. */
  BBOX: 24 * 60 * 60 * 1000,
  /** Fiches d'un POI (description/accès) : très stable. */
  FICHE: 7 * 24 * 60 * 60 * 1000,
  /** Commentaires refuges.info : on veut frais. */
  COMMENTS: 60 * 60 * 1000,
} as const;
