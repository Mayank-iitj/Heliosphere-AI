"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, Html } from "@react-three/drei";
import * as THREE from "three";

/**
 * Aditya L1 spacecraft orbiting around the Sun at Lagrange point L1.
 * The spacecraft is positioned at about 1.5 million km from Earth towards the Sun.
 * In the 3D visualization, it's shown orbiting the Sun at a visible scale.
 */
export default function OrbitingAdityaL1({
  orbitRadius = 3.5,
  speed = 0.15,
  scale = 0.15,
}: {
  orbitRadius?: number;
  speed?: number;
  scale?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const spacecraftRef = useRef<THREE.Group>(null);

  // Animation state
  const state = useRef({
    angle: 0,
    tiltPhase: Math.random() * Math.PI * 2,
  });

  useFrame((_, delta) => {
    if (!groupRef.current || !spacecraftRef.current) return;

    const s = state.current;

    // Orbital motion around the Sun
    s.angle += delta * speed;

    // Calculate position on orbit (slightly tilted orbital plane)
    const x = Math.cos(s.angle) * orbitRadius;
    const z = Math.sin(s.angle) * orbitRadius;
    const y = Math.sin(s.angle * 0.5 + s.tiltPhase) * 0.3;

    groupRef.current.position.set(x, y, z);

    // Point the spacecraft towards the Sun (L1 direction)
    spacecraftRef.current.lookAt(0, 0, 0);

    // Slight wobble for realism
    spacecraftRef.current.rotation.z += Math.sin(s.angle * 2) * 0.02;
  });

  // Materials
  const materials = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#1a1a2e"),
        metalness: 0.8,
        roughness: 0.2,
      }),
      panel: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0a0a1a"),
        metalness: 0.9,
        roughness: 0.1,
      }),
      gold: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#ffd700"),
        metalness: 0.9,
        roughness: 0.15,
      }),
      solar: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#1e3a5f"),
        metalness: 0.3,
        roughness: 0.4,
        emissive: new THREE.Color("#0a1628"),
        emissiveIntensity: 0.2,
      }),
      lens: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#87ceeb"),
        metalness: 0.1,
        roughness: 0.1,
        transparent: true,
        opacity: 0.7,
      }),
      antenna: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#c0c0c0"),
        metalness: 0.9,
        roughness: 0.1,
      }),
      glow: new THREE.MeshStandardMaterial({
        color: new THREE.Color("#00ff88"),
        emissive: new THREE.Color("#00ff88"),
        emissiveIntensity: 2,
      }),
    }),
    []
  );

  return (
    <group ref={groupRef}>
      <group ref={spacecraftRef} scale={scale}>
        <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.05}>
          {/* Main Bus - Solar Oriented Platform (SOP) */}
          <mesh material={materials.body} position={[0, 0, 0]}>
            <boxGeometry args={[1.8, 0.8, 1.2]} />
          </mesh>

          {/* Top deck with gold accents */}
          <mesh material={materials.gold} position={[0, 0.45, 0]}>
            <boxGeometry args={[1.4, 0.1, 0.8]} />
          </mesh>

          {/* VELC - Visible Emission Line Coronagraph */}
          <mesh
            material={materials.body}
            position={[0.5, 0.6, 0.2]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.15, 0.15, 0.4, 16]} />
          </mesh>

          {/* SUIT - Solar Ultraviolet Imaging Telescope */}
          <mesh
            material={materials.body}
            position={[-0.4, 0.6, 0.3]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.12, 0.12, 0.3, 16]} />
          </mesh>

          {/* PXL - Pixelated Lighttracker */}
          <mesh material={materials.lens} position={[0.3, 0.65, -0.2]}>
            <boxGeometry args={[0.2, 0.08, 0.15]} />
          </mesh>

          {/* Solar Panel 1 (left) */}
          <group position={[-1.5, 0, 0]}>
            <mesh material={materials.panel} position={[0.2, 0, 0]}>
              <boxGeometry args={[0.3, 0.1, 0.15]} />
            </mesh>
            {[0, 1, 2].map((i) => (
              <mesh key={i} material={materials.solar} position={[-0.4 - i * 0.9, 0, 0]}>
                <boxGeometry args={[0.8, 0.02, 1.6]} />
              </mesh>
            ))}
          </group>

          {/* Solar Panel 2 (right) */}
          <group position={[1.5, 0, 0]}>
            <mesh material={materials.panel} position={[-0.2, 0, 0]}>
              <boxGeometry args={[0.3, 0.1, 0.15]} />
            </mesh>
            {[0, 1, 2].map((i) => (
              <mesh key={i} material={materials.solar} position={[0.4 + i * 0.9, 0, 0]}>
                <boxGeometry args={[0.8, 0.02, 1.6]} />
              </mesh>
            ))}
          </group>

          {/* X-ray dish antenna */}
          <mesh
            material={materials.antenna}
            position={[0, -0.2, 0.8]}
            rotation={[Math.PI / 3, 0, 0]}
          >
            <coneGeometry args={[0.25, 0.15, 16]} />
          </mesh>

          {/* High gain antenna */}
          <mesh
            material={materials.antenna}
            position={[0, 0, -0.9]}
            rotation={[Math.PI, 0, 0]}
          >
            <torusGeometry args={[0.2, 0.03, 8, 16]} />
          </mesh>

          {/* STIX - Spectrometer/Telescope for Imaging X-rays */}
          <mesh material={materials.body} position={[-0.7, -0.2, 0.1]}>
            <boxGeometry args={[0.3, 0.25, 0.2]} />
          </mesh>

          {/* L1 position indicator - glowing green dot */}
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial
              color="#00ff88"
              emissive="#00ff88"
              emissiveIntensity={3}
            />
          </mesh>

          {/* Engine nozzles */}
          <mesh
            material={materials.panel}
            position={[0.4, -0.5, 0.3]}
            rotation={[Math.PI, 0, 0]}
          >
            <coneGeometry args={[0.06, 0.15, 8]} />
          </mesh>
          <mesh
            material={materials.panel}
            position={[-0.4, -0.5, 0.3]}
            rotation={[Math.PI, 0, 0]}
          >
            <coneGeometry args={[0.06, 0.15, 8]} />
          </mesh>

          {/* Point light for L1 glow effect */}
          <pointLight position={[0, 0.9, 0]} intensity={0.3} color="#00ff88" distance={2} />

          {/* Aditya-L1 Annotation */}
          <Html distanceFactor={8} position={[0, 1.8, 0]} center>
            <div className="pointer-events-none whitespace-nowrap rounded-md border border-[var(--color-panel-border)] bg-black/85 px-2 py-1 text-[9px] backdrop-blur shadow-[0_0_8px_rgba(0,255,136,0.25)]">
              <div className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-[#00ff88] shadow-[0_0_3px_#00ff88]"></span>
                <span className="font-mono font-bold text-[#00ff88]">
                  Aditya-L1
                </span>
              </div>
            </div>
          </Html>
        </Float>
      </group>

      {/* Orbital path visualization (more visible) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[orbitRadius - 0.015, orbitRadius + 0.015, 64]} />
        <meshBasicMaterial
          color="#00ff88"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}