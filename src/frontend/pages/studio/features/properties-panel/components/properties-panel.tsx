"use client";

import React from 'react';
import { useActivePropertiesTab, usePropertiesPanelStore, PropertiesTab } from '@/stores/properties-panel-store';
import { InspectorPanel } from './tabs/inspector-panel';
import { WorldPanel } from './tabs/world-panel';
import type { LucideIcon } from 'lucide-react';
import { Wrench, Box, Layers, Globe, Sliders, Camera } from 'lucide-react';
import ModifiersPanel from '@/frontend/pages/studio/features/properties-panel/components/tabs/modifiers-panel';
import * as motion from "motion/react-client"

type TabDef = { key: PropertiesTab; label: string; icon: LucideIcon };

const tabs: TabDef[] = [
  { key: 'inspector', label: 'Inspector', icon: Wrench },
  { key: 'scene', label: 'Scene', icon: Box },
  { key: 'view-layer', label: 'View Layer', icon: Layers },
  { key: 'world', label: 'World', icon: Globe },
  { key: 'modifiers', label: 'Modifiers', icon: Sliders },
  { key: 'render', label: 'Render', icon: Camera },
];

export const PropertiesPanel: React.FC = () => {
  const active = useActivePropertiesTab();
  const { setActiveTab } = usePropertiesPanelStore();

  return (
    <motion.div
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 50, opacity: 0 }}
      className="flex h-full w-80 flex-col rounded-[20px] border border-white/70 bg-white/75 text-[12px] text-[#20242a] shadow-[0_18px_48px_rgba(44,48,54,0.14)] backdrop-blur-xl"
    >
      <div className="border-b border-[#d7dbdd]/75 px-2 py-1.5">
        <div className="flex gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${active === key ? 'bg-[#8d8f92]/75 text-white shadow-sm' : 'text-[#606873] hover:bg-[#eef0f0]'}`}
              onClick={() => setActiveTab(key)}
              title={label}
              aria-label={label}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {active === 'inspector' && <InspectorPanel />}
        {active === 'world' && <WorldPanel />}
        {active === 'modifiers' && <ModifiersPanel />}
        {active !== 'inspector' && active !== 'world' && active !== 'modifiers' && (
          <div className="p-3 text-[11px] text-[#7a828c]">
            {tabs.find((t) => t.key === active)?.label} panel coming soon.
          </div>
        )}
      </div>
    </motion.div>
  );
};

