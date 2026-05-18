import { create } from 'zustand';
import type { ParsedGpx, PoiCandidate, TypeKey } from '@/lib/types';
import { ALL_TYPE_KEYS } from '@/lib/types';

interface AppState {
  trace: ParsedGpx | null;
  bufferStepIdx: number; // index dans BUFFER_STEPS
  enabledTypes: Set<TypeKey>;
  candidates: PoiCandidate[];
  selectedIds: Set<number>;
  isLoadingPois: boolean;
  apiError: string | null;
  detailOpenId: number | null;

  setTrace: (t: ParsedGpx | null) => void;
  setBufferStepIdx: (i: number) => void;
  toggleType: (k: TypeKey) => void;
  setEnabledTypes: (s: Set<TypeKey>) => void;
  setCandidates: (c: PoiCandidate[]) => void;
  toggleSelected: (id: number) => void;
  clearSelected: () => void;
  setLoading: (b: boolean) => void;
  setApiError: (e: string | null) => void;
  openDetail: (id: number | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  trace: null,
  bufferStepIdx: 2, // 500 m par défaut
  enabledTypes: new Set<TypeKey>(['refuge', 'cabane', 'gite', 'pt_eau']),
  candidates: [],
  selectedIds: new Set<number>(),
  isLoadingPois: false,
  apiError: null,
  detailOpenId: null,

  setTrace: (t) => set({ trace: t, candidates: [], selectedIds: new Set() }),
  setBufferStepIdx: (i) => set({ bufferStepIdx: i }),
  toggleType: (k) =>
    set((s) => {
      const next = new Set(s.enabledTypes);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return { enabledTypes: next };
    }),
  setEnabledTypes: (s) => set({ enabledTypes: s }),
  setCandidates: (c) =>
    set((s) => {
      // garder uniquement les sélections encore visibles
      const visibleIds = new Set(c.map((x) => x.id));
      const filteredSel = new Set<number>();
      s.selectedIds.forEach((id) => {
        if (visibleIds.has(id)) filteredSel.add(id);
      });
      return { candidates: c, selectedIds: filteredSel };
    }),
  toggleSelected: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  clearSelected: () => set({ selectedIds: new Set() }),
  setLoading: (b) => set({ isLoadingPois: b }),
  setApiError: (e) => set({ apiError: e }),
  openDetail: (id) => set({ detailOpenId: id }),
  reset: () =>
    set({
      trace: null,
      candidates: [],
      selectedIds: new Set(),
      apiError: null,
      detailOpenId: null,
      enabledTypes: new Set<TypeKey>(ALL_TYPE_KEYS.filter((t) => t !== 'pt_passage')),
    }),
}));
