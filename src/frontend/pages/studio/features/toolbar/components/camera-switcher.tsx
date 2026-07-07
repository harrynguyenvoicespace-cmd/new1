"use client";

import React, { useMemo } from 'react';
import { useSceneStore } from '@/stores/scene-store';
import { useViewportStore } from '@/stores/viewport-store';

export const CameraSwitcher: React.FC = () => {
  const objects = useSceneStore((s) => s.objects);
  const ids = useSceneStore((s) => s.rootObjects);
  const activeId = useViewportStore((s) => s.activeCameraObjectId ?? null);
  const setActive = useViewportStore((s) => s.setActiveCamera);

  const cameras = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const addRecursive = (id: string) => {
      const obj = objects[id];
      if (!obj) return;
      if (obj.type === 'camera' && obj.cameraId) list.push({ id: obj.id, name: obj.name });
      obj.children.forEach(addRecursive);
    };
    ids.forEach(addRecursive);
    return list;
  }, [objects, ids]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setActive(val === 'default' ? null : val);
  };

  return (
    <div className="pointer-events-auto flex h-8 items-center rounded-xl bg-white/70 px-3">
      <label className="sr-only" htmlFor="camera-switcher">Active camera</label>
      <select
        id="camera-switcher"
        className="max-w-36 appearance-none bg-transparent pr-3 text-xs font-medium text-[#2f343b] outline-none"
        value={activeId ?? 'default'}
        onChange={handleChange}
        title="Select active camera"
      >
        <option value="default">Default Camera</option>
        {cameras.map((cam) => (
          <option key={cam.id} value={cam.id}>{cam.name}</option>
        ))}
      </select>
    </div>
  );
};

export default CameraSwitcher;
