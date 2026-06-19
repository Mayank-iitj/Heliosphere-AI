"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const HeroScene = dynamic(() => import("./HeroScene"), {
  ssr: false,
  loading: () => <SunFallback />,
});

/** Pure-CSS sun used while the scene loads or when WebGL is unavailable. */
function SunFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div
        className="float-slow h-[46vmin] w-[46vmin] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 38% 35%, #ffe39a 0%, #ff8a00 42%, #ff5e3a 70%, #7a1d00 100%)",
          boxShadow:
            "0 0 120px 30px rgba(255,138,0,0.45), 0 0 240px 80px rgba(255,94,58,0.25)",
        }}
      />
    </div>
  );
}

function webglAvailable(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

export default function HeroCanvas({ activity = 0.5 }: { activity?: number }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    setOk(webglAvailable());
  }, []);

  if (ok === false) return <SunFallback />;
  if (ok === null) return <SunFallback />;
  return <HeroScene activity={activity} />;
}
