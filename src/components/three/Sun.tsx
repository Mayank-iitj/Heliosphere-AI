"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQuality } from "@/lib/quality";

/**
 * A physically-plausible Sun rendered entirely procedurally — no texture
 * downloads, so it stays crisp at any zoom and light on bandwidth for weak
 * devices. The surface uses 3D fractal Brownian motion (granulation cells),
 * limb darkening, animated convection flow, sunspots and bright plage.
 */

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vPos;

  void main() {
    vPos = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 viewPos = viewMatrix * worldPos;
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-viewPos.xyz);
    gl_Position = projectionMatrix * viewPos;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vPos;

  uniform float uTime;
  uniform float uActivity;     // 0..1 — drives flare brightness + spot density
  uniform vec3  uColorCore;
  uniform vec3  uColorMid;
  uniform vec3  uColorHot;
  uniform int   uOctaves;

  // --- iq-style simplex-ish value noise in 3D ---
  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
              dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
          mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
              dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
      mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
              dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
          mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
              dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y),
      u.z);
  }

  float fbm(vec3 p, int octaves) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Slow convective drift so granules churn realistically.
    vec3 p = normalize(vPos) * 2.6;
    float flow = uTime * 0.06;

    float granules = fbm(p * 2.2 + vec3(0.0, flow, 0.0), uOctaves);
    float macro = fbm(p * 0.9 - vec3(flow * 0.4), max(uOctaves - 2, 2));
    float surface = granules * 0.65 + macro * 0.5 + 0.5;

    // Sunspots: dark, sparse, slowly rotating umbral regions.
    float spotField = fbm(p * 1.3 + 7.0, max(uOctaves - 1, 2));
    float spots = smoothstep(0.55 - uActivity * 0.12, 0.74, spotField);

    // Bright plage / flare hotspots scale with activity.
    float plage = smoothstep(0.62, 0.92, granules + macro);
    float hot = plage * (0.35 + uActivity * 1.4);

    vec3 col = mix(uColorCore, uColorMid, clamp(surface, 0.0, 1.0));
    col = mix(col, uColorHot, hot);
    col = mix(col, uColorCore * 0.18, spots * 0.85);

    // Limb darkening — edges of the disc are cooler/darker than the centre.
    float ndv = clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
    float limb = pow(ndv, 0.55);
    col *= mix(0.45, 1.18, limb);

    // Bright rim where the chromosphere glows.
    float rim = pow(1.0 - ndv, 2.4);
    col += uColorHot * rim * (0.6 + uActivity * 0.6);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function Sun({
  radius = 1.6,
  activity = 0.45,
}: {
  radius?: number;
  activity?: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const segments = useQuality((s) => s.sunSegments);
  const tier = useQuality((s) => s.tier);
  const reducedMotion = useQuality((s) => s.reducedMotion);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uActivity: { value: activity },
      uColorCore: { value: new THREE.Color("#b32d00") },
      uColorMid: { value: new THREE.Color("#ff7a00") },
      uColorHot: { value: new THREE.Color("#ffe39a") },
      uOctaves: { value: tier === "low" ? 3 : tier === "medium" ? 5 : 6 },
    }),
    // colors/octaves are stable per tier; activity handled in useFrame
    [tier], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFrame((_, delta) => {
    if (matRef.current) {
      if (!reducedMotion) matRef.current.uniforms.uTime.value += delta;
      // Ease activity toward target so prop changes animate smoothly.
      const u = matRef.current.uniforms.uActivity;
      u.value += (activity - u.value) * Math.min(1, delta * 1.5);
    }
    if (meshRef.current && !reducedMotion) {
      meshRef.current.rotation.y += delta * 0.035; // ~ solar rotation, stylised
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, segments, segments]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
