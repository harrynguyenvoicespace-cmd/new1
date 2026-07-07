'use client';

import React from 'react';
import AddObjectMenu from '@/frontend/pages/studio/features/shared/add-object-menu';
import { useTerrainStore } from '@/stores/terrain-store';
import { useSelection, useSelectionStore } from '@/stores/selection-store';
import { useViewportStore } from '@/stores/viewport-store';
import { useSceneStore } from '@/stores/scene-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { useShapeCreationStore } from '@/stores/shape-creation-store';
import { useToolStore } from '@/stores/tool-store';
import { buildEdgesFromFaces, calculateVertexNormals, createCubeMesh, createPlaneMesh, createCylinderMesh, createConeMesh, createUVSphereMesh, createIcoSphereMesh, createTorusMesh } from '@/utils/geometry';
import { nanoid } from 'nanoid';
import { Pill } from './pill';
import { AIGeneratePopover } from './ai-generate-popover';
import * as motion from "motion/react-client"
import { AnimatePresence } from 'motion/react'
import { Popover } from '@base-ui-components/react/popover';
import { Magnet, Ellipsis, PanelLeft, PanelRight, Move3DIcon, Rotate3DIcon, Scale3DIcon } from 'lucide-react';
import { DragInput } from '@/components/drag-input';
import CameraSwitcher from './camera-switcher';

type TopToolbarProps = {
  scenePanelOpen?: boolean;
  propertiesPanelOpen?: boolean;
  onToggleScenePanel?: () => void;
  onTogglePropertiesPanel?: () => void;
};

const SegButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }>
  = ({ className = '', active = false, disabled = false, children, ...rest }) => (
    <motion.div
      layout
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={`rounded-xl ${className}`}
    >
      <button
        className={`px-3 py-1.5 text-xs rounded-xl font-medium transition-colors ${disabled ? 'cursor-not-allowed text-[#9aa0a6] opacity-60' : active ? 'bg-white text-[#1f2329] shadow-sm' : 'text-[#2f343b] hover:bg-white/70'} w-full h-full`}
        disabled={disabled}
        {...rest}
      >
        {children}
      </button>
    </motion.div>
  );

// Small SVG icon set for shading modes Ã¢â‚¬â€ Blender-style orbs
const IconWire: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    {/* outer sphere */}
    <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
    {/* latitude (equator) and vertical ellipse */}
    <ellipse cx="12" cy="12" rx="6.2" ry="2.8" stroke="currentColor" strokeWidth="0.9" fill="none" opacity="0.85" />
    <ellipse cx="12" cy="12" rx="2.8" ry="6.2" stroke="currentColor" strokeWidth="0.9" fill="none" opacity="0.6" transform="rotate(90 12 12)" />
    {/* meridian arcs (left / right) */}
    <path d="M6.25 6.75C8 8 8 16 6.25 17.25" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.75" fill="none" />
    <path d="M17.75 6.75C16 8 16 16 17.75 17.25" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.75" fill="none" />
  </svg>
)

const IconSolid: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    {/* filled sphere with subtle rim and highlight */}
    <circle cx="12" cy="12" r="7.2" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="0.6" />
    {/* soft highlight */}
    <circle cx="9.5" cy="9.2" r="2.8" fill="#ffffff" fillOpacity="0.12" />
    {/* thin seam for depth */}
    <ellipse cx="12" cy="12.6" rx="5.6" ry="1.9" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.04" />
  </svg>
)

const IconMaterial: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    {/* beach-ball style orb: three colored sectors with seams */}
    <circle cx="12" cy="12" r="7.2" fill="#ffffff" stroke="currentColor" strokeWidth="0.6" />
    {/* right (red) wedge */}
    <path d="M12 12 L15.6 5.8 A7.2 7.2 0 0 1 15.6 18.24 Z" fill="#ef4444" />
    {/* bottom (yellow) wedge */}
    <path d="M12 12 L15.6 18.24 A7.2 7.2 0 0 1 4.8 12 Z" fill="#f59e0b" />
    {/* left (blue) wedge */}
    <path d="M12 12 L4.8 12 A7.2 7.2 0 0 1 15.6 5.8 Z" fill="#2563eb" />
    {/* seams */}
    <path d="M12 3a9 9 0 0 1 0 18" stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.9" fill="none" strokeLinecap="round" />
    <path d="M4.8 12h14.4" stroke="#ffffff" strokeWidth="0.6" strokeOpacity="0.8" strokeLinecap="round" />
    {/* small highlight */}
    <circle cx="9.2" cy="8.8" r="1.3" fill="#ffffff" fillOpacity="0.9" />
  </svg>
)

const objectTransformTools = [
  { id: 'move', label: 'Move', shortcut: 'G', Icon: Move3DIcon },
  { id: 'rotate', label: 'Rotate', shortcut: 'R', Icon: Rotate3DIcon },
  { id: 'scale', label: 'Scale', shortcut: 'S', Icon: Scale3DIcon },
] as const;

const TopToolbar: React.FC<TopToolbarProps> = ({ scenePanelOpen = false, propertiesPanelOpen = false, onToggleScenePanel, onTogglePropertiesPanel }) => {
  const selection = useSelection();
  const selectionActions = useSelectionStore();
  const tools = useToolStore();
  const viewport = useViewportStore();
  const scene = useSceneStore();
  const geometry = useGeometryStore();
  const shapeCreation = useShapeCreationStore();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => { setPortalContainer(document.body); }, []);
  const canTransformObject = selection.viewMode === 'object' && selection.objectIds.length > 0;

  const beginShape = (shape: 'cube' | 'plane' | 'cylinder' | 'cone' | 'uvsphere' | 'icosphere' | 'torus') => {
    // If we're currently in edit mode, and there is an active mesh, merge the new mesh into
    // the active mesh instead of creating a new scene object. This only applies for mesh->mesh.
    if (selection.viewMode === 'edit' && selection.meshId) {
      const targetMeshId = selection.meshId;
      
      // Create the new mesh geometry directly without adding to store
      let newMesh;
      switch (shape) {
        case 'cube':
          newMesh = createCubeMesh(1.5); break;
        case 'plane':
          newMesh = createPlaneMesh(2, 2, 1, 1); break;
        case 'cylinder':
          newMesh = createCylinderMesh(0.75, 0.75, 2, 24, 1); break;
        case 'cone':
          newMesh = createConeMesh(0.9, 2, 24, 1); break;
        case 'uvsphere':
          newMesh = createUVSphereMesh(1, 24, 16); break;
        case 'icosphere':
          newMesh = createIcoSphereMesh(1, 1); break;
        case 'torus':
          newMesh = createTorusMesh(1.2, 0.35, 16, 24); break;
        default:
          return;
      }

      // Store the vertex IDs that will be added so we can select them later
      const newVertexIds: string[] = [];
      
      // Merge the new mesh into the target mesh
      geometry.updateMesh(targetMeshId, (target) => {
        // Build a mapping from new vertex id -> appended vertex id in target
        const idMap = new Map<string, string>();
        
        for (const v of newMesh.vertices) {
          // generate a fresh id to avoid collisions
          const freshId = nanoid();
          idMap.set(v.id, freshId);
          newVertexIds.push(freshId);
          target.vertices.push({ ...v, id: freshId });
        }

        // Append faces, remapping vertex ids
        for (const f of newMesh.faces) {
          const remapped = { ...f, id: nanoid() };
          remapped.vertexIds = f.vertexIds.map((vid) => idMap.get(vid) || vid);
          target.faces.push(remapped);
        }

        // Rebuild edges from faces to keep topology consistent
        target.edges = buildEdgesFromFaces(target.vertices, target.faces);
        target.vertices = calculateVertexNormals(target);
      });

      // After merging, select all the newly added vertices
      selectionActions.selectVertices(targetMeshId, newVertexIds);
      
      // Start shape creation panel for the merged shape (pass target mesh id)
      shapeCreation.start(shape, targetMeshId);
      setMenuOpen(false);
      return;
    }

    // Normal object mode behavior
    let id = '';
    let name = '';
    switch (shape) {
      case 'cube':
        id = geometry.createCube(1.5); name = 'Cube'; break;
      case 'plane':
        id = geometry.createPlane(2, 2, 1, 1); name = 'Plane'; break;
      case 'cylinder':
        id = geometry.createCylinder(0.75, 0.75, 2, 24, 1); name = 'Cylinder'; break;
      case 'cone':
        id = geometry.createCone(0.9, 2, 24, 1); name = 'Cone'; break;
      case 'uvsphere':
        id = geometry.createUVSphere(1, 24, 16); name = 'UV Sphere'; break;
      case 'icosphere':
        id = geometry.createIcoSphere(1, 1); name = 'Ico Sphere'; break;
      case 'torus':
        id = geometry.createTorus(1.2, 0.35, 16, 24); name = 'Torus'; break;
    }
    const objId = scene.createMeshObject(`${name} ${id.slice(-4)}`, id);
    scene.selectObject(objId);
    if (selection.viewMode === 'object') {
      selectionActions.selectObjects([objId]);
    }
    // Start shape creation panel
    shapeCreation.start(shape, id);
    setMenuOpen(false);
  };

  const addLight = (type: 'directional' | 'spot' | 'point' | 'ambient') => {
    const id = scene.createLightObject(
      `${type.charAt(0).toUpperCase() + type.slice(1)} Light`,
      type
    );
    scene.selectObject(id);
    if (selection.viewMode === 'object') selectionActions.selectObjects([id]);
  };

  const addCamera = (type: 'perspective' | 'orthographic') => {
    const id = scene.createCameraObject(
      type === 'perspective' ? 'Perspective Camera' : 'Orthographic Camera',
      type
    );
    scene.selectObject(id);
    if (selection.viewMode === 'object') selectionActions.selectObjects([id]);
  };

  const enterEdit = () => {
    if (selection.objectIds.length > 0) {
      const objId = selection.objectIds[0];
      const meshId = scene.objects[objId]?.meshId;
      const locked = scene.objects[objId]?.locked;
  const type = scene.objects[objId]?.type;
  if (type === 'metaball') return; // metaballs not editable in edit mode
      if (locked) return;
      if (meshId) selectionActions.enterEditMode(meshId);
    }
  };

  return (
    <Pill className="px-2 py-1">
      <div className="flex items-center gap-1 whitespace-nowrap">
        <SegButton
          aria-label="Toggle Scene Panel"
          title="Toggle Scene Panel"
          active={scenePanelOpen}
          onClick={onToggleScenePanel}
        >
          <PanelLeft className="h-4 w-4" />
        </SegButton>
        <SegButton
          aria-label="Toggle Properties Panel"
          title="Toggle Properties Panel"
          active={propertiesPanelOpen}
          onClick={onTogglePropertiesPanel}
        >
          <PanelRight className="h-4 w-4" />
        </SegButton>
        <SegButton
          aria-label="Toggle Grid Snapping"
          title="Toggle Grid Snapping"
          active={viewport.gridSnapping}
          onClick={() => viewport.setGridSnapping(!viewport.gridSnapping)}
        >
          <Magnet className="h-4 w-4" />
        </SegButton>
        <Popover.Root>
          <Popover.Trigger
            render={
              <SegButton aria-label="Grid Snap Settings" title="Grid Snap Settings">
                <Ellipsis className="h-4 w-4" />
              </SegButton>
            }
          />
          <Popover.Portal>
            <Popover.Positioner sideOffset={6} className="z-50">
              <Popover.Popup className="w-44 rounded-2xl border border-white/70 bg-white/95 p-3 text-xs text-[#23272d] shadow-[0_18px_38px_rgba(44,48,54,0.18)] backdrop-blur-xl">
                <Popover.Title className="mb-2 text-[11px] font-semibold text-[#69717c]">Grid Snapping</Popover.Title>
                <DragInput
                  label="Grid size"
                  value={viewport.gridSize}
                  min={0.01}
                  step={0.05}
                  precision={2}
                  onChange={viewport.setGridSize}
                  onValueCommit={viewport.setGridSize}
                  className="w-full"
                />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>

        <div className="mx-1 h-5 w-px bg-[#d8d9d7]" />

        <SegButton
          active={selection.viewMode === 'object'}
          onClick={() => {
            if (selection.viewMode === 'edit') selectionActions.exitEditMode();
            else selectionActions.setViewMode('object');
          }}
        >
          Object
        </SegButton>
        <SegButton active={selection.viewMode === 'edit'} onClick={enterEdit}>Edit</SegButton>
        <SegButton
          active={selection.viewMode === 'brush'}
          onClick={() => {
            if (selection.viewMode === 'edit') selectionActions.exitEditMode();
            selectionActions.setViewMode(selection.viewMode === 'brush' ? 'object' : 'brush');
          }}
        >
          Brush
        </SegButton>
        {selection.viewMode === 'object' && (
          <>
            <div className="mx-1 h-5 w-px bg-[#d8d9d7]" />
            {objectTransformTools.map(({ id, label, shortcut, Icon }) => (
              <SegButton
                key={id}
                aria-label={`${label} selected object`}
                title={canTransformObject ? `${label} (${shortcut})` : `Select an object to ${label.toLowerCase()}`}
                active={tools.isActive && tools.tool === id}
                disabled={!canTransformObject}
                onClick={() => tools.startOperation(id, null)}
              >
                <Icon className="h-4 w-4" />
              </SegButton>
            ))}
          </>
        )}
        {selection.viewMode === 'edit' && (
          <>
            <div className="mx-1 h-5 w-px bg-[#d8d9d7]" />
            <SegButton active={tools.editPalette === 'mesh'} onClick={() => tools.setEditPalette('mesh')}>Mesh</SegButton>
            <SegButton active={tools.editPalette === 'sculpt'} onClick={() => tools.setEditPalette('sculpt')}>Sculpt</SegButton>
            <SegButton active={selection.selectionMode === 'vertex'} onClick={() => selectionActions.setSelectionMode('vertex')}>V</SegButton>
            <SegButton active={selection.selectionMode === 'edge'} onClick={() => selectionActions.setSelectionMode('edge')}>E</SegButton>
            <SegButton active={selection.selectionMode === 'face'} onClick={() => selectionActions.setSelectionMode('face')}>F</SegButton>
          </>
        )}

        <div className="mx-1 h-5 w-px bg-[#d8d9d7]" />

        <SegButton
          aria-label="Wireframe"
          active={viewport.shadingMode === 'wireframe'}
          onClick={() => viewport.setShadingMode('wireframe')}
        ><IconWire /></SegButton>
        <SegButton
          aria-label="Solid"
          active={viewport.shadingMode === 'solid'}
          onClick={() => viewport.setShadingMode('solid')}
        ><IconSolid /></SegButton>
        <SegButton
          aria-label="Material"
          active={viewport.shadingMode === 'material'}
          onClick={() => viewport.setShadingMode('material')}
        ><IconMaterial /></SegButton>

        <div className="mx-1 h-5 w-px bg-[#d8d9d7]" />

        <AddObjectMenu
          portalContainer={portalContainer}
          controlledOpen={menuOpen}
          onOpenChange={setMenuOpen}
          triggerLabel={"Add"}
          triggerClassName={"rounded-xl px-3 py-1.5 text-xs font-medium text-[#2f343b] hover:bg-white/70 data-[open]:bg-white data-[open]:text-[#1f2329]"}
          onCreateShape={beginShape}
          onAddLight={addLight}
          onAddCamera={addCamera}
          onCreateTerrain={(type) => {
            const res = useTerrainStore.getState().createTerrain({}, type);
            if (res?.objectId) {
              scene.selectObject(res.objectId);
              if (selection.viewMode === 'object') selectionActions.selectObjects([res.objectId]);
            }
            setMenuOpen(false);
          }}
        />
      </div>
    </Pill>
  );
};

export default TopToolbar;







