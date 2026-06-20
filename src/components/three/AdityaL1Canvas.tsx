"use client";

import { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import AdityaL1 from "./AdityaL1";

/**
 * Scroll-linked Aditya L1 canvas.
 * The spacecraft floats and rotates based on scroll position.
 */
export default function AdityaL1Canvas({
  interactive = false,
  className,
}: {
  interactive?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const scrollProgress = 1 - rect.top / (windowHeight + rect.height);
      setScrollY(Math.max(0, Math.min(1, scrollProgress)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div ref={containerRef} className={className}>
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <directionalLight position={[-5, 3, -5]} intensity={0.3} color="#87ceeb" />
          <pointLight position={[0, 0, 3]} intensity={0.5} color="#ffd700" />

          <AdityaL1 scrollOffset={scrollY} interactive={interactive} scale={0.8} />

          {interactive && (
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              minPolarAngle={Math.PI / 3}
              maxPolarAngle={Math.PI / 1.5}
            />
          )}

          <Environment preset="night" />
        </Suspense>
      </Canvas>
    </div>
  );
}