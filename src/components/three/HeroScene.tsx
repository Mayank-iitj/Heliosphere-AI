"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useQuality } from "@/lib/quality";
import Sun from "./Sun";
import Corona from "./Corona";
import Starfield from "./Starfield";
import OrbitingBody from "./OrbitingBody";

/** Gentle mouse-parallax camera — no controls, so scroll stays native. */
function CameraRig() {
  const reducedMotion = useQuality((s) => s.reducedMotion);
  const target = useRef({ x: 0, y: 0 });

  useFrame((state) => {
    if (reducedMotion) return;
    const p = state.pointer; // -1..1
    target.current.x += (p.x * 0.6 - target.current.x) * 0.04;
    target.current.y += (p.y * 0.35 - target.current.y) * 0.04;
    state.camera.position.x = target.current.x;
    state.camera.position.y = target.current.y;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function HeroScene({ activity = 0.5 }: { activity?: number }) {
  const dpr = useQuality((s) => s.dpr);
  const tier = useQuality((s) => s.tier);

  return (
    <Canvas
      dpr={dpr}
      gl={{
        antialias: tier !== "low",
        powerPreference: "high-performance",
        alpha: true,
      }}
      camera={{ position: [0, 0, 6], fov: 42 }}
      // Pause rendering when the canvas scrolls out of view to save battery.
      frameloop="always"
    >
      <color attach="background" args={["#04060d"]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 0, 0]} intensity={2.2} color="#ffb454" distance={40} />

      <Suspense fallback={null}>
        <Starfield />
        <group>
          <Sun radius={1.7} activity={activity} />
          <Corona />
        </group>
        {tier !== "low" && (
          <>
            <OrbitingBody radius={3.2} size={0.12} color="#7fb4ff" speed={0.18} phase={1.2} tilt={0.18} />
            <OrbitingBody radius={4.3} size={0.16} color="#ff9e7a" speed={0.12} phase={3.4} tilt={-0.1} />
          </>
        )}
        <CameraRig />
      </Suspense>
    </Canvas>
  );
}
