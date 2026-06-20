"use client";

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useScroll, Float, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

/**
 * Procedural 3D model of Aditya-L1 spacecraft.
 *
 * Aditya-L1 is India's first solar mission, positioned at Lagrange point L1.
 * The spacecraft has:
 * - Solar Oriented Platform (SOP) - main rectangular bus
 * - Multiple payloads for different observations
 * - Solar panels on both sides
 */
export default function AdityaL1({
  scrollOffset = 0,
  interactive = false,
  scale = 1
}: {
  scrollOffset?: number;
  interactive?: boolean;
  scale?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const scroll = useScroll();
  const { viewport } = useThree();

  // Animation state
  const state = useRef({
    rotationY: 0,
    targetRotationY: 0,
    floatOffset: 0,
  });

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const s = state.current;

    // Scroll-based position and rotation
    const scrollProgress = scroll?.offset ?? scrollOffset;

    // Gentle rotation when not interactive
    if (!interactive) {
      s.targetRotationY += delta * 0.15;
    }

    // Smooth interpolation
    s.rotationY = THREE.MathUtils.lerp(s.rotationY, s.targetRotationY, 0.05);

    // Apply transforms
    groupRef.current.rotation.y = s.rotationY;

    // Scroll-based float effect
    const floatY = Math.sin(scrollProgress * Math.PI * 2) * 0.3;
    groupRef.current.position.y = floatY;

    // Subtle tilt based on scroll
    groupRef.current.rotation.x = Math.sin(scrollProgress * Math.PI) * 0.1;
    groupRef.current.rotation.z = Math.cos(scrollProgress * Math.PI * 0.5) * 0.05;
  });

  // Materials
  const materials = useMemo(() => ({
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
  }), []);

  return (
    <group ref={groupRef} scale={scale}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.3}>
        {/* Main Bus - Solar Oriented Platform (SOP) */}
        <mesh material={materials.body} position={[0, 0, 0]}>
          <boxGeometry args={[1.8, 0.8, 1.2]} />
        </mesh>

        {/* Top deck details */}
        <mesh material={materials.gold} position={[0, 0.45, 0]}>
          <boxGeometry args={[1.4, 0.1, 0.8]} />
        </mesh>

        {/* VAP (Visible Emission Line Coronagraph) - cylinder */}
        <mesh material={materials.body} position={[0.5, 0.6, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.4, 16]} />
        </mesh>

        {/* SUDEX (Solar UV Imaging Telescope) */}
        <mesh material={materials.body} position={[-0.4, 0.6, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.3, 16]} />
        </mesh>

        {/* PXL (Pixelated Lighttracker) - small box */}
        <mesh material={materials.lens} position={[0.3, 0.65, -0.2]}>
          <boxGeometry args={[0.2, 0.08, 0.15]} />
        </mesh>

        {/* Solar Panel 1 (left) */}
        <group position={[-1.5, 0, 0]}>
          {/* Panel hinge */}
          <mesh material={materials.panel} position={[0.2, 0, 0]}>
            <boxGeometry args={[0.3, 0.1, 0.15]} />
          </mesh>
          {/* Panel segments */}
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
        <mesh material={materials.antenna} position={[0, -0.2, 0.8]} rotation={[Math.PI / 3, 0, 0]}>
          <coneGeometry args={[0.25, 0.15, 16]} />
        </mesh>

        {/* High gain antenna (dish) */}
        <mesh material={materials.antenna} position={[0, 0, -0.9]} rotation={[Math.PI, 0, 0]}>
          <torusGeometry args={[0.2, 0.03, 8, 16]} />
        </mesh>

        {/* STIX (Spectrometer/Telescope for Imaging X-rays) - box */}
        <mesh material={materials.body} position={[-0.7, -0.2, 0.1]}>
          <boxGeometry args={[0.3, 0.25, 0.2]} />
        </mesh>

        {/* Link to L1 label marker */}
        <mesh position={[0, 0.9, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial
            color="#00ff88"
            emissive="#00ff88"
            emissiveIntensity={2}
          />
        </mesh>

        {/* Engine nozzles */}
        <mesh material={materials.panel} position={[0.4, -0.5, 0.3]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.06, 0.15, 8]} />
        </mesh>
        <mesh material={materials.panel} position={[-0.4, -0.5, 0.3]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.06, 0.15, 8]} />
        </mesh>
      </Float>
    </group>
  );
}