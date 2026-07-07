import { create } from 'zustand';
import { nanoid } from 'nanoid';

export type GeneratedModelAssetKind = 'model' | 'file';

export type GeneratedModelAsset = {
  id: string;
  label: string;
  url: string;
  key: string;
  kind: GeneratedModelAssetKind;
  source: string;
  taskId?: string;
  status?: string;
  createdAt: number;
  importedAt?: number;
};

type GeneratedModelInput = Partial<Pick<GeneratedModelAsset, 'id' | 'createdAt' | 'importedAt'>> &
  Pick<GeneratedModelAsset, 'label' | 'url' | 'key' | 'source'> & {
    kind?: GeneratedModelAssetKind;
    taskId?: string;
    status?: string;
  };

type GeneratedModelsStore = {
  assets: GeneratedModelAsset[];
  selectedId: string | null;
  addAssets: (assets: GeneratedModelInput[]) => void;
  selectAsset: (id: string | null) => void;
  markImported: (id: string) => void;
  removeAsset: (id: string) => void;
  clearAssets: () => void;
};

const STORAGE_KEY = 'freed.generatedModels.v1';
const MAX_ASSETS = 40;

function readStoredAssets(): GeneratedModelAsset[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is GeneratedModelAsset => Boolean(item?.id && item?.url && item?.label))
      .slice(0, MAX_ASSETS);
  } catch {
    return [];
  }
}

function writeStoredAssets(assets: GeneratedModelAsset[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assets.slice(0, MAX_ASSETS)));
}

function normalizeAsset(input: GeneratedModelInput): GeneratedModelAsset | null {
  const url = String(input.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return {
    id: input.id || nanoid(),
    label: String(input.label || '3D Model'),
    url,
    key: String(input.key || 'model_url'),
    kind: input.kind || 'model',
    source: String(input.source || 'Tripo'),
    taskId: input.taskId,
    status: input.status,
    createdAt: input.createdAt || Date.now(),
    importedAt: input.importedAt,
  };
}

export const useGeneratedModelsStore = create<GeneratedModelsStore>((set) => ({
  assets: readStoredAssets(),
  selectedId: null,

  addAssets: (inputs) => {
    const normalized = inputs.map(normalizeAsset).filter((item): item is GeneratedModelAsset => Boolean(item));
    if (!normalized.length) return;

    set((state) => {
      let assets = [...state.assets];
      for (const item of normalized) {
        const existing = assets.find((asset) => asset.url === item.url);
        const next: GeneratedModelAsset = {
          ...item,
          id: existing?.id || item.id,
          createdAt: existing?.createdAt || item.createdAt,
          importedAt: existing?.importedAt || item.importedAt,
        };
        assets = [next, ...assets.filter((asset) => asset.url !== item.url)];
      }
      assets = assets.slice(0, MAX_ASSETS);
      writeStoredAssets(assets);
      return { assets, selectedId: assets[0]?.id || state.selectedId };
    });
  },

  selectAsset: (id) => set({ selectedId: id }),

  markImported: (id) => {
    set((state) => {
      const assets = state.assets.map((asset) => asset.id === id ? { ...asset, importedAt: Date.now() } : asset);
      writeStoredAssets(assets);
      return { assets, selectedId: id };
    });
  },

  removeAsset: (id) => {
    set((state) => {
      const assets = state.assets.filter((asset) => asset.id !== id);
      writeStoredAssets(assets);
      return { assets, selectedId: state.selectedId === id ? assets[0]?.id || null : state.selectedId };
    });
  },

  clearAssets: () => {
    writeStoredAssets([]);
    set({ assets: [], selectedId: null });
  },
}));