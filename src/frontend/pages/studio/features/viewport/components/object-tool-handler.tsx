'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import type { BufferGeometry, Material, Object3D } from 'three';
import type { TransformControls as TransformControlsImpl } from 'three-stdlib';
import type { ToolMode } from '@/stores/tool-store';
import { useToolStore } from '@/stores/tool-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useSceneStore } from '@/stores/scene-store';
import { useViewportStore } from '@/stores/viewport-store';
import { getObject3D } from '../hooks/object3d-registry';

type TransformMode = 'translate' | 'rotate' | 'scale';

type TransformSnapshot = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
};

const TRANSFORM_TOOLS = new Set<ToolMode>(['move', 'rotate', 'scale']);
const GIZMO_SIZE_BY_MODE: Record<TransformMode, number> = {
  translate: 1.24,
  rotate: 1.14,
  scale: 1.18,
};
const PICKER_HIT_AREA_SCALE_BY_MODE: Record<TransformMode, number> = {
  translate: 1.75,
  rotate: 1.45,
  scale: 1.65,
};
const MAX_SCALE_SNAP = 0.25;

type GeometryObject = Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
type TransformGizmoInternals = {
  gizmo?: { picker?: Partial<Record<TransformMode, Object3D>> };
  _gizmo?: { picker?: Partial<Record<TransformMode, Object3D>> };
};

function modeForTool(tool: ToolMode): TransformMode {
  if (tool === 'rotate') return 'rotate';
  if (tool === 'scale') return 'scale';
  return 'translate';
}

function toolForMode(mode: TransformMode): ToolMode {
  if (mode === 'rotate') return 'rotate';
  if (mode === 'scale') return 'scale';
  return 'move';
}

function snapshotObject(object: Object3D): TransformSnapshot {
  return {
    position: { x: object.position.x, y: object.position.y, z: object.position.z },
    rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
    scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z },
  };
}

function applySnapshot(object: Object3D, snapshot: TransformSnapshot) {
  object.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
  object.rotation.set(snapshot.rotation.x, snapshot.rotation.y, snapshot.rotation.z);
  object.scale.set(snapshot.scale.x, snapshot.scale.y, snapshot.scale.z);
  object.updateMatrixWorld(true);
}

function commitObjectTransform(objectId: string, object: Object3D) {
  useSceneStore.getState().setTransform(objectId, snapshotObject(object));
}

function commitSnapshotTransform(objectId: string, snapshot: TransformSnapshot) {
  useSceneStore.getState().setTransform(objectId, snapshot);
}

function getRegisteredObject(objectId: string): Object3D | null {
  return (getObject3D(objectId) as unknown as Object3D | undefined) ?? null;
}

function forEachMaterial(object: Object3D, callback: (material: Material) => void) {
  const material = (object as GeometryObject).material;
  if (Array.isArray(material)) {
    material.forEach(callback);
  } else if (material) {
    callback(material);
  }
}

function getTransformGizmo(control: TransformControlsImpl) {
  const internals = control as unknown as TransformGizmoInternals;
  return internals.gizmo ?? internals._gizmo ?? null;
}

function tuneTransformControls(control: TransformControlsImpl) {
  const transformGizmo = getTransformGizmo(control);

  (Object.keys(PICKER_HIT_AREA_SCALE_BY_MODE) as TransformMode[]).forEach((pickerMode) => {
    const picker = transformGizmo?.picker?.[pickerMode];
    if (!picker) return;

    picker.traverse((child) => {
      const geometry = (child as GeometryObject).geometry;
      if (!geometry || geometry.userData.transformHitAreaBoosted) return;

      const scale = PICKER_HIT_AREA_SCALE_BY_MODE[pickerMode];
      geometry.scale(scale, scale, scale);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      geometry.userData.transformHitAreaBoosted = true;
    });
  });

  control.traverse((child) => {
    child.renderOrder = Infinity;
    forEachMaterial(child, (material) => {
      material.depthTest = false;
      material.depthWrite = false;
      material.needsUpdate = true;
    });
  });
}

function getScaleSnap(gridSize: number) {
  return Math.max(0.05, Math.min(gridSize, MAX_SCALE_SNAP));
}

export const ObjectToolHandler: React.FC = () => {
  const selectedObjectId = useSelectionStore((state) =>
    state.selection.viewMode === 'object' ? state.selection.objectIds[0] ?? null : null
  );
  const selectedObject = useSceneStore((state) => (selectedObjectId ? state.objects[selectedObjectId] : null));
  const activeTool = useToolStore((state) => state.tool);
  const gridSnapping = useViewportStore((state) => state.gridSnapping);
  const gridSize = useViewportStore((state) => state.gridSize);
  const [target, setTarget] = useState<Object3D | null>(null);
  const controlsRef = useRef<TransformControlsImpl | null>(null);
  const dragStartRef = useRef<TransformSnapshot | null>(null);
  const draggingRef = useRef(false);
  const liveCommitFrameRef = useRef<number | null>(null);

  const mode = useMemo(() => modeForTool(activeTool), [activeTool]);
  const gizmoSize = GIZMO_SIZE_BY_MODE[mode];

  useEffect(() => {
    if (!selectedObjectId || !selectedObject || selectedObject.locked) {
      setTarget(null);
      return;
    }

    let cancelled = false;
    const resolveTarget = () => {
      if (!cancelled) setTarget(getRegisteredObject(selectedObjectId));
    };

    resolveTarget();
    const frame = requestAnimationFrame(resolveTarget);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [selectedObjectId, selectedObject]);

  useEffect(() => {
    return () => {
      if (liveCommitFrameRef.current !== null) {
        cancelAnimationFrame(liveCommitFrameRef.current);
        liveCommitFrameRef.current = null;
      }
      useToolStore.getState().setBrushPlacing(false);
    };
  }, []);

  useEffect(() => {
    if (!controlsRef.current) return;
    tuneTransformControls(controlsRef.current);
  }, [target]);

  const queueLiveCommit = useCallback(() => {
    if (!selectedObjectId || !target || liveCommitFrameRef.current !== null) return;

    liveCommitFrameRef.current = requestAnimationFrame(() => {
      liveCommitFrameRef.current = null;
      commitObjectTransform(selectedObjectId, target);
    });
  }, [selectedObjectId, target]);

  const beginDrag = useCallback(() => {
    if (!target) return;
    dragStartRef.current = snapshotObject(target);
    draggingRef.current = true;

    const tools = useToolStore.getState();
    if (!TRANSFORM_TOOLS.has(tools.tool)) {
      tools.startOperation(toolForMode(mode), null);
    }
    tools.setBrushPlacing(true);
  }, [mode, target]);

  const finishDrag = useCallback((commit: boolean) => {
    if (!selectedObjectId || !target) return;

    if (liveCommitFrameRef.current !== null) {
      cancelAnimationFrame(liveCommitFrameRef.current);
      liveCommitFrameRef.current = null;
    }

    if (commit) {
      commitObjectTransform(selectedObjectId, target);
    } else if (dragStartRef.current) {
      applySnapshot(target, dragStartRef.current);
      commitSnapshotTransform(selectedObjectId, dragStartRef.current);
    }

    dragStartRef.current = null;
    draggingRef.current = false;
    useToolStore.getState().setBrushPlacing(false);
  }, [selectedObjectId, target]);

  const handleObjectChange = useCallback(() => {
    if (!draggingRef.current) return;
    queueLiveCommit();
  }, [queueLiveCommit]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!draggingRef.current || event.key !== 'Escape') return;
      event.preventDefault();
      finishDrag(false);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [finishDrag]);

  if (!selectedObjectId || !selectedObject || selectedObject.locked || !target) return null;

  return (
    <TransformControls
      ref={controlsRef}
      object={target}
      mode={mode}
      space="world"
      size={gizmoSize}
      translationSnap={gridSnapping ? gridSize : null}
      rotationSnap={gridSnapping ? Math.PI / 12 : null}
      scaleSnap={gridSnapping ? getScaleSnap(gridSize) : null}
      showX
      showY
      showZ
      onMouseDown={beginDrag}
      onMouseUp={() => finishDrag(true)}
      onObjectChange={handleObjectChange}
    />
  );
};

export default ObjectToolHandler;
