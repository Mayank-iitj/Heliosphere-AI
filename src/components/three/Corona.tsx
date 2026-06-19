"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuality } from "@/lib/quality";

/**
 * Two additive shells: an inner chromosphere rim and an outer corona haze.
 * Rendered back-side with a fresnel falloff so it reads as volumetric glow
 * without any post-processing (cheap on integrated GPUs).
 */
const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-viewPos.xyz);
    gl_Position = projectionMatrix * viewPos;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;
  uniform float uTime;
  void main() {
    float fres = pow(1.0 - clamp(dot(vNormal, vViewDir), 0.0, 1.0), uPower);
    float pulse = 0.92 + 0.08 * sin(uTime * 0.8);
    gl_FragColor = vec4(uColor, fres * uIntensity * pulse);
  }
`;

function Shell({
  scale,
  color,
  intensity,
  power,
}: {
  scale: number;
  color: string;
  intensity: number;
  power: number;
}) {
  const ref = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uPower: { value: power },
      uTime: { value: 0 },
    }),
    [color, intensity, power],
  );
  useFrame((_, d) => {
    if (ref.current) ref.current.uniforms.uTime.value += d;
  });
  return (
    <mesh scale={scale}>
      <sphereGeometry args={[1.6, 64, 64]} />
      <shaderMaterial
        ref={ref}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function Corona() {
  const enabled = useQuality((s) => s.enableCorona);
  if (!enabled) {
    // Low tier: one cheap rim shell only.
    return <Shell scale={1.08} color="#ff9a3c" intensity={0.7} power={3.0} />;
  }
  return (
    <group>
      <Shell scale={1.06} color="#ffd27a" intensity={0.9} power={3.2} />
      <Shell scale={1.35} color="#ff7a1a" intensity={0.35} power={2.0} />
      <Shell scale={1.9} color="#ff5e3a" intensity={0.14} power={1.4} />
    </group>
  );
}
