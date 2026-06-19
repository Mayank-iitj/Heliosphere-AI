"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuality } from "@/lib/quality";

/**
 * A small planet on a circular orbit + its faint orbit ring. Used purely as
 * scale/aesthetic accents around the Sun on the landing hero.
 */
export default function OrbitingBody({
  radius,
  size,
  color,
  speed,
  phase = 0,
  tilt = 0,
}: {
  radius: number;
  size: number;
  color: string;
  speed: number;
  phase?: number;
  tilt?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const reducedMotion = useQuality((s) => s.reducedMotion);
  const segments = useQuality((s) => (s.tier === "low" ? 16 : 32));

  const ringGeo = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2);
    const pts = curve.getPoints(128).map((p) => new THREE.Vector3(p.x, 0, p.y));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = reducedMotion ? phase : state.clock.elapsedTime * speed + phase;
    ref.current.position.set(Math.cos(t) * radius, 0, Math.sin(t) * radius);
  });

  return (
    <group rotation={[tilt, 0, 0]}>
      <lineLoop geometry={ringGeo}>
        <lineBasicMaterial color={color} transparent opacity={0.18} />
      </lineLoop>
      <group ref={ref}>
        <mesh>
          <sphereGeometry args={[size, segments, segments]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.25}
            roughness={0.6}
            metalness={0.1}
          />
        </mesh>
      </group>
    </group>
  );
}
