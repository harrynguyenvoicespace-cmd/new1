'use client';

import { useState } from 'react';
import { Archive, Box, Download, Eye, Loader2, Trash2 } from 'lucide-react';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { useGeometryStore } from '@/stores/geometry-store';
import { useGeneratedModelsStore, type GeneratedModelAsset } from '@/stores/generated-models-store';
import { useSceneStore } from '@/stores/scene-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useViewportStore } from '@/stores/viewport-store';
import { importGLTFFile, type ImportSummary } from '@/utils/gltf-importer';
import { studioApiRoot } from '@/frontend/pages/studio/lib/api-root';
import styles from './generated-models-panel.module.css';

const modelExt = ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.3mf', '.usdz'];

function apiRoot() {
  return studioApiRoot();
}

function clientKey() {
  if (typeof window === 'undefined') return 'local-dev-key';
  return (window.localStorage.getItem('freed.api.clientKey') || 'local-dev-key').trim();
}

function extOf(url: string) {
  const clean = url.split('?')[0].toLowerCase();
  return modelExt.find((ext) => clean.endsWith(ext)) || '';
}

function canView(asset: GeneratedModelAsset) {
  const ext = extOf(asset.url);
  if (ext) return ext === '.glb' || ext === '.gltf';
  return /gltf|glb|model|mesh|output/i.test(asset.key);
}

function proxiedUrl(asset: GeneratedModelAsset) {
  const root = apiRoot();
  if (asset.url.includes('/hymotion/animations/') || asset.url.startsWith(root)) return asset.url;
  return `${root}/tripo/download?url=${encodeURIComponent(asset.url)}`;
}

function filename(asset: GeneratedModelAsset) {
  try {
    return new URL(asset.url).pathname.split('/').pop() || `tripo-model${extOf(asset.url) || '.bin'}`;
  } catch {
    return `tripo-model${extOf(asset.url) || '.bin'}`;
  }
}

async function gltfFilename(asset: GeneratedModelAsset, blob: Blob) {
  let name = filename(asset).replace(/[^\w .-]+/g, ' ').trim() || 'tripo-output';
  let ext = extOf(asset.url).toLowerCase();
  if (ext !== '.glb' && ext !== '.gltf') {
    const type = blob.type.toLowerCase();
    if (type.includes('gltf+json') || type.includes('json')) ext = '.gltf';
    else {
      const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      ext = head[0] === 0x67 && head[1] === 0x6c && head[2] === 0x54 && head[3] === 0x46 ? '.glb' : '.gltf';
    }
  }
  if (!/\.(glb|gltf)$/i.test(name)) name = `${name.replace(/\.[^.]+$/, '') || 'tripo-output'}${ext || '.glb'}`;
  return name;
}

function boundsForImported(summary: ImportSummary) {
  const scene = useSceneStore.getState();
  const geom = useGeometryStore.getState();
  const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  const matrices = new Map<string, Matrix4>();

  const matrixFor = (id: string): Matrix4 => {
    const cached = matrices.get(id);
    if (cached) return cached;
    const obj = scene.objects[id];
    const local = new Matrix4();
    if (obj) {
      local.compose(
        new Vector3(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z),
        new Quaternion().setFromEuler(new Euler(obj.transform.rotation.x, obj.transform.rotation.y, obj.transform.rotation.z)),
        new Vector3(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z),
      );
    }
    const world = obj?.parentId && scene.objects[obj.parentId] ? matrixFor(obj.parentId).clone().multiply(local) : local;
    matrices.set(id, world);
    return world;
  };

  let any = false;
  for (const oid of summary.createdObjectIds) {
    const obj = scene.objects[oid];
    if (!obj?.meshId) continue;
    const mesh = geom.meshes.get(obj.meshId);
    if (!mesh) continue;
    const mat = matrixFor(oid);
    for (const vertex of mesh.vertices) {
      const point = new Vector3(vertex.position.x, vertex.position.y, vertex.position.z).applyMatrix4(mat);
      min.min(point);
      max.max(point);
      any = true;
    }
  }

  if (!any) return null;
  const center = min.clone().add(max).multiplyScalar(0.5);
  const sizeVec = max.clone().sub(min);
  return { center: [center.x, center.y, center.z] as [number, number, number], size: Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 0.5) };
}

function revealImported(summary: ImportSummary) {
  useSceneStore.getState().selectObject(summary.rootGroupId);
  const selection = useSelectionStore.getState();
  if (selection.selection.viewMode === 'object') selection.selectObjects([summary.rootGroupId], false);
  const bounds = boundsForImported(summary);
  if (bounds) useViewportStore.getState().focusOnObject(bounds.center, bounds.size);
}

export default function GeneratedModelsPanel() {
  const assets = useGeneratedModelsStore((state) => state.assets);
  const selectedId = useGeneratedModelsStore((state) => state.selectedId);
  const selectAsset = useGeneratedModelsStore((state) => state.selectAsset);
  const markImported = useGeneratedModelsStore((state) => state.markImported);
  const removeAsset = useGeneratedModelsStore((state) => state.removeAsset);
  const clearAssets = useGeneratedModelsStore((state) => state.clearAssets);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function viewAsset(asset: GeneratedModelAsset) {
    if (!canView(asset)) return;
    setBusyId(asset.id);
    setError('');
    try {
      const response = await fetch(proxiedUrl(asset), { headers: { 'x-api-key': clientKey() } });
      if (!response.ok) throw new Error(`Download failed HTTP ${response.status}`);
      const blob = await response.blob();
      const summary = await importGLTFFile(new File([blob], await gltfFilename(asset, blob), { type: blob.type || 'model/gltf-binary' }));
      revealImported(summary);
      markImported(asset.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function downloadAsset(asset: GeneratedModelAsset) {
    setBusyId(asset.id);
    setError('');
    try {
      const response = await fetch(proxiedUrl(asset), { headers: { 'x-api-key': clientKey() } });
      if (!response.ok) throw new Error(`Download failed HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename(asset);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <aside className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.titleIcon}><Archive size={18} /></div>
        <div className={styles.headingBlock}>
          <h2>Generated</h2>
          <p>Tripo model library</p>
        </div>
        <span className={styles.count}>{assets.length}</span>
      </header>

      <div className={styles.actionsRow}>
        <button type="button" className={styles.smallButton} onClick={clearAssets} disabled={!assets.length}>
          Clear
        </button>
      </div>

      <div className={styles.list}>
        {!assets.length ? (
          <div className={styles.empty}>
            <Box size={26} />
            <strong>No models yet</strong>
            <span>Run a Tripo model task and the output will appear here.</span>
          </div>
        ) : assets.map((asset) => {
          const viewable = canView(asset);
          const active = selectedId === asset.id;
          const busy = busyId === asset.id;
          return (
            <article key={asset.id} className={`${styles.card} ${active ? styles.cardActive : ''}`} onClick={() => selectAsset(asset.id)}>
              <div className={styles.preview}>
                <Box size={28} />
                <span>{extOf(asset.url).replace('.', '').toUpperCase() || '3D'}</span>
              </div>
              <div className={styles.meta}>
                <strong>{asset.label}</strong>
                <span>{asset.source}</span>
                <code>{filename(asset)}</code>
              </div>
              <div className={styles.cardActions}>
                <button type="button" onClick={(event) => { event.stopPropagation(); viewAsset(asset); }} disabled={!viewable || busy} title={viewable ? 'Open in viewport' : 'Only GLB/GLTF can open in viewport'}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
                  View
                </button>
                <button type="button" onClick={(event) => { event.stopPropagation(); downloadAsset(asset); }} disabled={busy} title="Download model">
                  <Download size={15} />
                </button>
                <button type="button" onClick={(event) => { event.stopPropagation(); removeAsset(asset.id); }} disabled={busy} title="Remove from panel">
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
    </aside>
  );
}
