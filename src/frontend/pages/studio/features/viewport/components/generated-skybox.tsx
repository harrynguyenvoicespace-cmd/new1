'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  ClampToEdgeWrapping,
  DoubleSide,
  LinearFilter,
  SRGBColorSpace,
  TextureLoader,
  type Group,
  type Texture,
} from 'three';
import { useViewportStore } from '@/stores/viewport-store';
import type { SkyboxFaceName, SkyboxFaces } from '@/types/geometry';

const SKYBOX_SIZE = 900;
const HALF = SKYBOX_SIZE * 0.5;

const faceOrder: SkyboxFaceName[] = ['front', 'back', 'left', 'right', 'up', 'down'];

type SkyboxTextureMap = Record<SkyboxFaceName, Texture>;

const faceLayout: Record<SkyboxFaceName, { position: [number, number, number]; rotation: [number, number, number]; textureRotation?: number }> = {
  front: { position: [0, 0, HALF], rotation: [0, Math.PI, 0] },
  back: { position: [0, 0, -HALF], rotation: [0, 0, 0] },
  left: { position: [-HALF, 0, 0], rotation: [0, Math.PI / 2, 0] },
  right: { position: [HALF, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  up: { position: [0, HALF, 0], rotation: [Math.PI / 2, 0, 0], textureRotation: Math.PI / 2 },
  down: { position: [0, -HALF, 0], rotation: [-Math.PI / 2, 0, 0], textureRotation: -Math.PI / 2 },
};

function completeFaces(faces: SkyboxFaces | null | undefined): faces is SkyboxFaces {
  return Boolean(faces && faceOrder.every((face) => faces[face]));
}

function configureTexture(texture: Texture, face: SkyboxFaceName) {
  const layout = faceLayout[face];
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 1;
  texture.center.set(0.5, 0.5);
  texture.rotation = layout.textureRotation || 0;
  texture.needsUpdate = true;
  return texture;
}

function loadSkyboxTexture(loader: TextureLoader, face: SkyboxFaceName, url: string) {
  return new Promise<[SkyboxFaceName, Texture]>((resolve, reject) => {
    try {
      loader.load(
        url,
        (texture) => resolve([face, configureTexture(texture, face)]),
        undefined,
        (error) => reject({ face, url, error })
      );
    } catch (error) {
      reject({ face, url, error });
    }
  });
}

function GeneratedSkyboxFaces({ faces }: { faces: SkyboxFaces }) {
  const groupRef = useRef<Group>(null);
  const { camera } = useThree();
  const [textures, setTextures] = useState<SkyboxTextureMap | null>(null);
  const urls = useMemo(() => faceOrder.map((face) => faces[face]), [faces]);

  useEffect(() => {
    let cancelled = false;
    const loader = new TextureLoader();
    const loadedTextures: Texture[] = [];

    setTextures(null);

    Promise.all(faceOrder.map((face) => loadSkyboxTexture(loader, face, faces[face]).then((entry) => {
      loadedTextures.push(entry[1]);
      return entry;
    })))
      .then((entries) => {
        const next = entries.reduce((acc, [face, texture]) => {
          loadedTextures.push(texture);
          acc[face] = texture;
          return acc;
        }, {} as SkyboxTextureMap);

        if (cancelled) {
          Object.values(next).forEach((texture) => texture.dispose());
          return;
        }
        setTextures(next);
      })
      .catch((error) => {
        loadedTextures.forEach((texture) => texture.dispose());
        if (!cancelled) {
          console.warn('Skybox texture failed to load', error);
          setTextures(null);
        }
      });

    return () => {
      cancelled = true;
      loadedTextures.forEach((texture) => texture.dispose());
    };
  }, [faces, urls]);

  useFrame(() => {
    if (groupRef.current) groupRef.current.position.copy(camera.position);
  });

  if (!textures) return null;

  return (
    <group ref={groupRef} name="GeneratedSkybox" renderOrder={-1000}>
      {faceOrder.map((face) => {
        const layout = faceLayout[face];
        return (
          <mesh
            key={`${face}-${faces[face]}`}
            name={`GeneratedSkybox:${face}`}
            position={layout.position}
            rotation={layout.rotation}
            frustumCulled={false}
            renderOrder={-1000}
          >
            <planeGeometry args={[SKYBOX_SIZE, SKYBOX_SIZE]} />
            <meshBasicMaterial
              map={textures[face]}
              side={DoubleSide}
              depthTest={false}
              depthWrite={false}
              fog={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export default function GeneratedSkybox() {
  const faces = useViewportStore((state) => state.skyboxFaces);
  if (!completeFaces(faces)) return null;
  return <GeneratedSkyboxFaces faces={faces} />;
}


