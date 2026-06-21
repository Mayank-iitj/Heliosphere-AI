"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { useQuality } from "@/lib/quality";
import type { ActiveRegion } from "@/lib/api";
import { RISK_COLOR } from "@/components/ui/primitives";
import Sun from "./Sun";
import Corona from "./Corona";
import Starfield from "./Starfield";
import OrbitingAdityaL1 from "./OrbitingAdityaL1";

const SUN_R = 1.7;

function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function RegionMarker({
  region,
  onSelect,
  selected,
}: {
  region: ActiveRegion;
  onSelect: (r: ActiveRegion | null) => void;
  selected: boolean;
}) {
  const pos = useMemo(
    () => latLonToVec3(region.lat, region.lon, SUN_R + 0.02),
    [region.lat, region.lon],
  );
  const color = RISK_COLOR[region.risk] ?? RISK_COLOR.Low;
  const size = 0.05 + (region.area / 1000) * 0.12;

  return (
    <group position={pos}>
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(selected ? null : region);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {selected && (
        <Html distanceFactor={8} position={[0, size + 0.15, 0]} center>
          <div className="pointer-events-none whitespace-nowrap rounded-lg border border-[var(--color-panel-border)] bg-black/85 px-3 py-2 text-[11px] backdrop-blur">
            <div className="font-mono font-semibold text-[var(--color-ink)]">
              AR{region.noaa_number}
            </div>
            <div className="text-[var(--color-ink-muted)]">
              {region.classification} · {region.area} MH · {region.risk}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export default function TwinScene({
  activity,
  regions,
  onSelect,
  selectedId,
}: {
  activity: number;
  regions: ActiveRegion[];
  onSelect: (r: ActiveRegion | null) => void;
  selectedId?: string | null;
}) {
  const dpr = useQuality((s) => s.dpr);
  const tier = useQuality((s) => s.tier);

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: tier !== "low", powerPreference: "high-performance", alpha: true }}
      camera={{ position: [0, 0, 5.2], fov: 45 }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#04060d"]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 0, 0]} intensity={2.4} color="#ffb454" distance={40} />
      <Suspense fallback={null}>
        <Starfield />
        <Sun radius={SUN_R} activity={activity} />
        <Corona />
        <OrbitingAdityaL1 orbitRadius={3.5} speed={0.12} scale={0.22} />
        {regions.map((r) => (
          <RegionMarker
            key={r.id}
            region={r}
            onSelect={onSelect}
            selected={selectedId === r.id}
          />
        ))}
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={3.2}
        maxDistance={9}
        autoRotate
        autoRotateSpeed={tier === "low" ? 0 : 0.5}
        rotateSpeed={0.6}
      />
    </Canvas>
  );
}
