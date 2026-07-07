"use client";

import MenuBar from '@/frontend/pages/studio/features/menu/components/menu-bar';
import SceneHierarchyPanel from '@/frontend/pages/studio/features/scene-hierarchy/components/scene-hierarchy-panel';
import { ShapeAdjustPanel } from '@/frontend/pages/studio/features/shape-creation';
import { TopToolbar } from '@/frontend/pages/studio/features/toolbar';
import { EditToolsToolbar } from '@/frontend/pages/studio/features/toolbar';
import { SculptToolsToolbar } from '@/frontend/pages/studio/features/toolbar/components/sculpt-tools-toolbar';
import { useToolStore } from '@/stores/tool-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { ToolIndicator } from '@/frontend/pages/studio/features/tools';
import { EditorViewport } from '@/frontend/pages/studio/features/viewport';
import { PropertiesPanel } from '@/frontend/pages/studio/features/properties-panel/components/properties-panel';
import React from 'react';
import ShaderEditor from '@/frontend/pages/studio/features/materials/components/shader-editor';
import { useShaderEditorStore } from '@/stores/shader-editor-store';
import { CameraSwitcher } from '@/frontend/pages/studio/features/toolbar';
import UVEditor from '@/frontend/pages/studio/features/uv-editor/components/uv-editor';
import { useUVEditorStore } from '@/stores/uv-editor-store';
import { AnimatePresence } from "motion/react"

import TerrainEditor from '@/frontend/pages/studio/features/terrain/components/terrain-editor'
import { useTerrainEditorStore } from '@/stores/terrain-editor-store';
import QuickBrushBar from '@/frontend/pages/studio/features/quick-brush/components/quick-brush-bar';

const EditorLayout: React.FC = () => {
  const shaderOpen = useShaderEditorStore((s) => s.open);
  const setShaderOpen = useShaderEditorStore((s) => s.setOpen);
  const editPalette = useToolStore((s) => s.editPalette);
  const minimalUi = useWorkspaceStore((s) => s.minimalUi ?? false);
  const uvOpen = useUVEditorStore((s) => s.open);
  const setUVOpen = useUVEditorStore((s) => s.setOpen);
  const [scenePanelOpen, setScenePanelOpen] = React.useState(false);
  const [propertiesPanelOpen, setPropertiesPanelOpen] = React.useState(false);

  return (
    <div data-editor-layout className="h-full w-full overflow-hidden bg-[#dfe3e2] text-[#17181c]">
      <div data-editor-menu-bar>
        <MenuBar onOpenShaderEditor={() => setShaderOpen(true)} />
      </div>

      <div data-editor-content className="flex h-[calc(100%-32px)] w-full flex-col">
        <div className="relative flex-1 overflow-hidden">
          <EditorViewport />

          <div data-editor-floating-toolbar className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
            <TopToolbar
              scenePanelOpen={scenePanelOpen}
              propertiesPanelOpen={propertiesPanelOpen}
              onToggleScenePanel={() => setScenePanelOpen((open) => !open)}
              onTogglePropertiesPanel={() => setPropertiesPanelOpen((open) => !open)}
            />
            <AnimatePresence mode="popLayout">
              {editPalette === 'sculpt' ? <SculptToolsToolbar /> : <EditToolsToolbar />}
            </AnimatePresence>
            <AnimatePresence>
              <QuickBrushBar />
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {!minimalUi && scenePanelOpen && (
              <div className="absolute left-5 top-[118px] z-20 h-[58dvh]">
                <SceneHierarchyPanel />
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!minimalUi && propertiesPanelOpen && (
              <div className="absolute right-5 top-[118px] z-20 h-[58dvh]">
                <PropertiesPanel />
              </div>
            )}
          </AnimatePresence>

          <ToolIndicator />

          <div data-editor-bottom-tools className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
            <ShapeAdjustPanel />
          </div>

          <ShaderEditor open={shaderOpen} onOpenChange={setShaderOpen} />
          <UVEditor open={uvOpen} onOpenChange={setUVOpen} />

          <TerrainEditor open={useTerrainEditorStore((s) => s.open)} onOpenChange={() => { }} />
        </div>
      </div>
    </div>
  );
};

export default EditorLayout;
