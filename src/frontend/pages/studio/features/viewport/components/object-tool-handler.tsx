'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import type { Object3D } from 'three';
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

function getRegisteredObject(objectId: string): Object3D | null {
  return (getObject3D(objectId) as unknown as Object3D | undefined) ?? null;
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
  const dragStartRef = useRef<TransformSnapshot | null>(null);
  const draggingRef = useRef(false);

  const mode = useMemo(() => modeForTool(activeTool), [activeTool]);

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
      useToolStore.getState().setBrushPlacing(false);
    };
  }, []);

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

    if (commit) {
      commitObjectTransform(selectedObjectId, target);
    } else if (dragStartRef.current) {
      applySnapshot(target, dragStartRef.current);
    }

    dragStartRef.current = null;
    draggingRef.current = false;
    useToolStore.getState().setBrushPlacing(false);
  }, [selectedObjectId, target]);

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
      object={target}
      mode={mode}
      space="world"
      size={0.9}
      translationSnap={gridSnapping ? gridSize : null}
      rotationSnap={gridSnapping ? Math.PI / 12 : null}
      scaleSnap={gridSnapping ? gridSize : null}
      showX
      showY
      showZ
      onMouseDown={beginDrag}
      onMouseUp={() => finishDrag(true)}
    />
  );
};

export default ObjectToolHandler;
