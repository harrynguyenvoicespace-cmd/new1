"use client";
import { useEffect, useState } from 'react';
import { Box, Eye, WandSparkles } from 'lucide-react';
import { StoreProvider } from '@/stores';
import { ShortcutProvider } from '@/components/shortcut-provider';
import EditorLayout from '@/frontend/pages/studio/features/layout/components/editor-layout';
import TripoPanel from '@/frontend/pages/studio/components/tripo-panel';
import GeneratedModelsPanel from '@/frontend/pages/studio/components/generated-models-panel';
import { useViewportStore } from '@/stores/viewport-store';
import { useWorldStore } from '@/stores/world-store';
import styles from './studio-page.module.css';

function StudioDefaults() {
  useEffect(() => {
    const applyViewportDefaults = () => {
      const viewport = useViewportStore.getState();
      const mobile = window.innerWidth < 768;

      viewport.setBackgroundColor([0.865, 0.855, 0.828]);
      viewport.setShadingMode('material');
      viewport.setCamera({
        position: mobile ? { x: 0, y: 2.25, z: 13.8 } : { x: 0, y: 2.15, z: 8.35 },
        target: mobile ? { x: 0, y: 1.42, z: 0 } : { x: 0, y: 1.34, z: 0 },
        fov: mobile ? 48 : 34,
        near: 0.04,
        far: 500,
      });
    };

    applyViewportDefaults();
    window.addEventListener('resize', applyViewportDefaults);

    useWorldStore.getState().setRenderer({
      exposure: 0.92,
      shadows: true,
      shadowType: 'PCFSoft',
      physicallyCorrectLights: true,
    });

    return () => window.removeEventListener('resize', applyViewportDefaults);
  }, []);

  return null;
}

export default function StudioPage() {
  const [mobilePane, setMobilePane] = useState<'tools' | 'viewer' | 'assets'>('tools');
  const mobileTabs = [
    { id: 'tools' as const, label: 'Bộ công cụ', icon: WandSparkles },
    { id: 'viewer' as const, label: 'Trình xem', icon: Eye },
    { id: 'assets' as const, label: 'Assets', icon: Box },
  ];

  return (
    <StoreProvider>
      <ShortcutProvider>
        <StudioDefaults />
        <div className={`freed-light-theme ${styles.studioShell}`}>
          <div className={styles.studioGrid}>
            <section className={`${styles.mobilePane} ${mobilePane === 'tools' ? styles.mobilePaneActive : ''}`}>
              <TripoPanel />
            </section>
            <main className={`${styles.viewerPane} ${styles.mobilePane} ${mobilePane === 'viewer' ? styles.mobilePaneActive : ''}`}>
              <div data-studio-viewer-frame className="h-full overflow-hidden rounded-[16px] border border-[#d7dbdd]/80 bg-[#e7e9e8] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <EditorLayout />
              </div>
            </main>
            <section className={`${styles.mobilePane} ${mobilePane === 'assets' ? styles.mobilePaneActive : ''}`}>
              <GeneratedModelsPanel />
            </section>
          </div>
          <nav className={styles.mobileTabBar} aria-label="AI Studio mobile panes">
            {mobileTabs.map((tab) => {
              const Icon = tab.icon;
              const active = mobilePane === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={active ? styles.mobileTabActive : ''}
                  onClick={() => setMobilePane(tab.id)}
                  aria-pressed={active}
                >
                  <Icon size={19} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </ShortcutProvider>
    </StoreProvider>
  );
}


