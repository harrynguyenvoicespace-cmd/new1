"use client";

import React, { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

function SoftFootShadow() {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const gradient = context.createRadialGradient(256, 128, 10, 256, 128, 245);
    gradient.addColorStop(0, "rgba(80, 78, 72, 0.34)");
    gradient.addColorStop(0.42, "rgba(80, 78, 72, 0.20)");
    gradient.addColorStop(0.74, "rgba(80, 78, 72, 0.07)");
    gradient.addColorStop(1, "rgba(80, 78, 72, 0)");

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const image = new THREE.CanvasTexture(canvas);
    image.colorSpace = THREE.SRGBColorSpace;
    image.minFilter = THREE.LinearFilter;
    image.magFilter = THREE.LinearFilter;
    image.needsUpdate = true;
    return image;
  }, []);

  if (!texture) return null;

  return (
    <mesh
      position={[0.85, 0.018, 0.46]}
      rotation={[-Math.PI / 2, 0, -0.04]}
      scale={[5.9, 2.25, 1]}
      renderOrder={-1}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.86}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function R6ReferenceAvatar() {
  const { scene } = useGLTF("/models/r6-final.gltf");

  const avatar = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const scale = size.y > 0 ? 3.15 / size.y : 1;

    clone.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.raycast = () => undefined;

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        if ("roughness" in material) material.roughness = Math.min((material.roughness as number) ?? 0.65, 0.58);
        if ("metalness" in material) material.metalness = 0;
      });
    });

    clone.position.set(-center.x * scale, -box.min.y * scale + 0.002, -center.z * scale);
    clone.scale.setScalar(scale);
    return clone;
  }, [scene]);

  return <primitive object={avatar} />;
}

export default function AiStudioReferenceStage() {
  return (
    <>
      <ambientLight intensity={0.52} />
      <hemisphereLight args={["#fff3e2", "#c7bfb2", 0.78]} />
      <directionalLight position={[-3.8, 6.8, 5.4]} intensity={1.48} castShadow />
      <directionalLight position={[2.6, 4.4, 5.8]} intensity={0.74} />
      <pointLight position={[0, 2.8, 4]} intensity={9.5} distance={7.5} decay={2} />

      <SoftFootShadow />

      <Suspense fallback={null}>
        <R6ReferenceAvatar />
      </Suspense>
    </>
  );
}

useGLTF.preload("/models/r6-final.gltf");
