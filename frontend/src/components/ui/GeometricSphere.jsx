import React, { useCallback, useEffect, useRef } from "react";

// --- CONFIGURATION BLOCK for Easy Remixing ---
export const CONFIG = {
  // Visuals (tuned to ARGUS police-blue theme)
  primaryColor: "34, 211, 238", // RGB for Sky (Wireframe & Main Glow)
  secondaryColor: "34, 211, 238", // RGB for Blue (Core Light)

  // Animation Speed (Higher value = slower animation)
  sphereRotationDuration: "60s",
  gridPanDuration: "40s",
  coreGlowDuration: "6s",

  // Intensity & Depth
  wireframeOpacity: 0.55,
  wireframeShadowIntensity: 24,
  coreBlur: 120,
  parallaxDepth: 22,
  lerpFactor: 0.08,
  sphereDensity: 14,
};

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * GeometricSphereBackground
 * Self-contained animated background: panning grid + haze + core glow
 * + rotating wireframe sphere + bloom + vignette.
 * Renders behind content (absolute inset-0, pointer-events-none).
 * No props required. All tuning via CONFIG above.
 */
export default function GeometricSphereBackground() {
  const targetRef = useRef({ x: 0, y: 0 });
  const smoothRef = useRef({ x: 0, y: 0 });
  const layerRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    targetRef.current = {
      x: (e.clientX - centerX) / centerX,
      y: (e.clientY - centerY) / centerY,
    };
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    let raf;
    const tick = () => {
      smoothRef.current.x = lerp(smoothRef.current.x, targetRef.current.x, CONFIG.lerpFactor);
      smoothRef.current.y = lerp(smoothRef.current.y, targetRef.current.y, CONFIG.lerpFactor);
      const { x, y } = smoothRef.current;
      if (layerRef.current) {
        layerRef.current.style.setProperty("--mx", x.toFixed(4));
        layerRef.current.style.setProperty("--my", y.toFixed(4));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(raf);
    };
  }, [handleMouseMove]);

  const sphereRings = Array.from({ length: CONFIG.sphereDensity }, (_, i) => {
    const step = 180 / CONFIG.sphereDensity;
    const angle = i * step;
    return (
      <div
        key={`ring-${i}`}
        className="sphere-wire-ring"
        style={{
          transform: i % 2 === 0 ? `rotateY(${angle}deg)` : `rotateX(${angle}deg)`,
          borderColor: `rgba(${CONFIG.primaryColor}, ${CONFIG.wireframeOpacity})`,
          boxShadow: `0 0 ${CONFIG.wireframeShadowIntensity}px rgba(${CONFIG.primaryColor}, 0.35), inset 0 0 ${CONFIG.wireframeShadowIntensity / 2}px rgba(${CONFIG.primaryColor}, 0.18)`,
        }}
        aria-hidden="true"
      />
    );
  });

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="sphere-bg-root"
      style={{
        "--mx": 0,
        "--my": 0,
        "--sphere-rotation-duration": CONFIG.sphereRotationDuration,
        "--grid-pan-duration": CONFIG.gridPanDuration,
        "--core-glow-duration": CONFIG.coreGlowDuration,
      }}
    >
      {/* Layer 0: panning grid */}
      <div
        className="sphere-layer sphere-panning-grid"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34, 211, 238, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.09) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      {/* Layer 1: volumetric haze */}
      <div
        className="sphere-layer"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 45%, rgba(${CONFIG.primaryColor}, 0.16) 0%, transparent 55%)`,
          filter: "blur(60px)",
          mixBlendMode: "screen",
        }}
      />
      {/* Layer 2: deep base + core glow */}
      <div
        className="sphere-layer"
        style={{
          backgroundImage: `radial-gradient(at 50% 50%, rgba(${CONFIG.primaryColor}, 0.10) 0%, #020617 75%, #000000 100%)`,
        }}
      >
        <div
          className="sphere-core-light"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(${CONFIG.secondaryColor}, 0.5) 0%, transparent 70%)`,
            filter: `blur(${CONFIG.coreBlur}px)`,
            boxShadow: `0 0 ${CONFIG.coreBlur / 2}px 30px rgba(${CONFIG.secondaryColor}, 0.22), 0 0 ${CONFIG.coreBlur}px 50px rgba(${CONFIG.primaryColor}, 0.16)`,
          }}
        />
      </div>

      {/* Layer 3: wireframe sphere */}
      <div className="sphere-3d-wrap">
        <div
          className="sphere-rotation"
          style={{ animationDuration: CONFIG.sphereRotationDuration }}
        >
          {sphereRings}
          {/* equator glow disc */}
          <div
            className="sphere-equator"
            style={{ borderColor: `rgba(${CONFIG.primaryColor}, 0.5)` }}
          />
        </div>
      </div>

      {/* Layer 4: bloom */}
      <div
        className="sphere-layer"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(${CONFIG.primaryColor}, 0.22) 0%, transparent 50%), radial-gradient(circle at 12% 12%, rgba(${CONFIG.secondaryColor}, 0.18) 0%, transparent 32%)`,
          mixBlendMode: "screen",
          filter: "blur(80px)",
          opacity: 0.9,
        }}
      />
      {/* Layer 5: scanlines + noise */}
      <div className="sphere-scanlines" />
      {/* Vignette */}
      <div className="sphere-vignette" />
    </div>
  );
}
