import React, { useState, useEffect, useCallback, useRef } from "react";

// --- CONFIGURATION BLOCK for Easy Remixing ---
export const CONFIG = {
  // Visuals — ARGUS police-blue theme
  primaryColor: "6, 182, 212", // RGB Purple (Wireframe & Main Glow)
  secondaryColor: "34, 211, 238", // RGB Blue (Core Light)

  // Animation Speed (Higher value = slower animation)
  sphereRotationDuration: "240s", // full sphere rotation (spec)
  gridPanDuration: "180s", // full background grid pan (spec)
  coreGlowDuration: "25s", // core light pulsation

  // Intensity & Depth
  wireframeOpacity: 0.75, // opacity of wireframe lines
  wireframeShadowIntensity: 70, // glow size (px) of wireframe
  coreBlur: 200, // blur radius (px) of core light
  parallaxDepth: 35, // mouse-follow strength
  lerpFactor: 0.08, // smoothing factor (0.01 slow, 0.2 fast)
  sphereDensity: 12, // number of layered rings
};

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * SphereHero
 *
 * Self-contained animated backdrop with layered layers:
 *  0. panning grid
 *  1. volumetric haze
 *  2. deep base + chromatic core glow
 *  3. animated wireframe sphere (multiple rings)
 *  4. soft bloom
 *  5. film-grain noise (inline SVG data URI — no external asset)
 *  6. vignette
 *
 * When `showContent` is true, also renders the foreground hero copy.
 * Login.jsx passes `showContent={false}` so only the animated backdrop
 * shows behind the existing login card + GuideChat.
 *
 * All visual tuning via CONFIG for remixing.
 */
export default function SphereHero({ showContent = true }) {
  // Mouse target + smoothed position live in refs (never in state), so the
  // rAF loop never destroys the real mouse target and never re-subscribes
  // every frame. A tick counter drives the per-frame re-render instead.
  const targetRef = useRef({ x: 0, y: 0 });
  const smoothRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef();
  const [, setTick] = useState(0);

  const animateLerp = useCallback(() => {
    const t = targetRef.current;
    const s = smoothRef.current;
    s.x = lerp(s.x, t.x, CONFIG.lerpFactor);
    s.y = lerp(s.y, t.y, CONFIG.lerpFactor);
    setTick((n) => n + 1);
    animationFrameRef.current = requestAnimationFrame(animateLerp);
  }, []);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animateLerp);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [animateLerp]);

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
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  const { x: smoothX, y: smoothY } = smoothRef.current;
  const parallaxDepth = CONFIG.parallaxDepth;
  const rotationStrength = 5;

  const baseTranslate = `translate3d(${smoothX * parallaxDepth}px, ${smoothY * parallaxDepth}px, 0)`;
  const gridTranslate = `translate3d(${-smoothX * (parallaxDepth / 2)}px, ${-smoothY * (parallaxDepth / 2)}px, 0)`;
  const hazeTranslate = `translate3d(${smoothX * (parallaxDepth / 2)}px, ${smoothY * (parallaxDepth / 2)}px, 0)`;
  const tiltRotateX = smoothY * rotationStrength;
  const tiltRotateY = -smoothX * rotationStrength;
  const tiltTranslate = `rotateX(${tiltRotateX}deg) rotateY(${tiltRotateY}deg)`;

  // Wireframe rings — border + glow are inline so remixing via CONFIG works
  // Generate a TRUE 3D wireframe globe: meridians (0→180° around Y)
  // PLUS latitude parallels stacked in Z, so perspective separates
  // the rings in depth — this is what the eye reads as "3D".
  const R = 350; // half of the 700px sphere box
  const HALF = Math.ceil(CONFIG.sphereDensity / 2);
  const sphereRings = Array.from({ length: CONFIG.sphereDensity }, (_, i) => {
    if (i < HALF) {
      const angle = (i * 180) / HALF;
      return (
        <div
          key={`meridian-${i}`}
          className="wireframe-line"
          style={{
            transform: `rotateY(${angle}deg)`,
            borderColor: `rgba(${CONFIG.primaryColor}, ${CONFIG.wireframeOpacity})`,
            boxShadow: `0 0 ${CONFIG.wireframeShadowIntensity}px rgba(${CONFIG.primaryColor}, 0.35), inset 0 0 ${CONFIG.wireframeShadowIntensity / 2}px rgba(${CONFIG.primaryColor}, 0.18)`,
          }}
          aria-hidden="true"
        />
      );
    }
    const j = i - HALF;
    const lat = HALF > 1 ? -60 + (j * 120) / (HALF - 1) : 0;
    const rad = (lat * Math.PI) / 180;
    const ringR = Math.max(Math.cos(rad) * R, 8);
    const y = -Math.sin(rad) * R;
    const d = ringR * 2;
    return (
      <div
        key={`parallel-${j}`}
        className="wireframe-line"
        style={{
          width: `${d}px`,
          height: `${d}px`,
          marginLeft: `${-ringR}px`,
          marginTop: `${-ringR}px`,
          transform: `translateY(${y.toFixed(1)}px) rotateX(90deg)`,
          borderColor: `rgba(${CONFIG.primaryColor}, ${CONFIG.wireframeOpacity})`,
          boxShadow: `0 0 ${CONFIG.wireframeShadowIntensity}px rgba(${CONFIG.primaryColor}, 0.35), inset 0 0 ${CONFIG.wireframeShadowIntensity / 2}px rgba(${CONFIG.primaryColor}, 0.18)`,
        }}
        aria-hidden="true"
      />
    );
  });

  // Reliable inline-SVG film-grain (no external CDN dependency)
  const noiseDataUri =
    "data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E";

  const coreLightStyle = {
    width: "400px",
    height: "400px",
    backgroundImage: `radial-gradient(circle, rgba(${CONFIG.secondaryColor}, 0.45) 0%, transparent 70%)`,
    filter: `blur(${CONFIG.coreBlur}px)`,
    boxShadow: `0 0 ${CONFIG.coreBlur / 2}px 30px rgba(${CONFIG.secondaryColor}, 0.2), 0 0 ${CONFIG.coreBlur}px 50px rgba(${CONFIG.primaryColor}, 0.15)`,
  };

  const panningGridStyle = {
    transform: gridTranslate,
    backgroundImage:
      "repeating-linear-gradient(to right, rgba(10,10,10,0.9) 1px, transparent 1px), repeating-linear-gradient(to bottom, rgba(10,10,10,0.9) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    opacity: 0.15,
  };

  const hazeStyle = {
    transform: hazeTranslate,
    backgroundImage: `radial-gradient(circle at 50% 50%, rgba(${CONFIG.primaryColor}, 0.15) 0%, transparent 50%)`,
    filter: "blur(150px)",
    opacity: 0.6,
    mixBlendMode: "screen",
  };

  const deepBaseStyle = {
    transform: baseTranslate,
    backgroundImage: `radial-gradient(at 50% 50%, rgba(${CONFIG.primaryColor}, 0.08) 0%, #030712 90%)`,
  };

  const bloomStyle = {
    transform: baseTranslate,
    backgroundImage: `radial-gradient(circle at 50% 50%, rgba(${CONFIG.primaryColor}, 0.35) 0%, transparent 50%), radial-gradient(circle at 10% 10%, rgba(${CONFIG.secondaryColor}, 0.25) 0%, transparent 30%)`,
    mixBlendMode: "screen",
    filter: "blur(100px)",
    opacity: 0.95,
  };

  const noiseStyle = {
    backgroundImage: `url("${noiseDataUri}")`,
    backgroundSize: "200px",
    opacity: 0.05,
    mixBlendMode: "overlay",
  };

  // Outer wrapper handles centering + parallax + tilt.
  // Inner .sphere-rotation only runs the rotation animation — no transform
  // conflict, because the tilt lives on the parent wrapper.
  const sphereWrapperStyle = {
    transform: `${baseTranslate} ${tiltTranslate}`,
  };

  return (
    <div className="absolute inset-0 w-full overflow-hidden font-sans">
      {/* Layer 0: Panning Grid (farthest back) */}
      <div className="absolute inset-0 panning-grid" style={panningGridStyle} />

      {/* Layer 1: Volumetric Haze */}
      <div className="absolute inset-0" style={hazeStyle} />

      {/* Layer 2: Deep base + core glow */}
      <div className="absolute inset-0" style={deepBaseStyle}>
        <div
          className="core-light absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={coreLightStyle}
        />
      </div>

      {/* Layer 3: Geometric wireframe sphere */}
      <div
        className="sphere-container z-40 pointer-events-none"
        style={{
          ...sphereWrapperStyle,
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "700px",
          height: "700px",
          // Inline negative margins = centering can never be overridden
          margin: "-350px 0 0 -350px",
        }}
      >
        <div
          className="sphere-rotation"
          style={{
            inset: 0,
            animationDuration: CONFIG.sphereRotationDuration,
            transformOrigin: "center center",
          }}
        >
          {sphereRings}
        </div>
      </div>

      {/* Layer 4: Soft radial bloom */}
      <div className="absolute inset-0" style={bloomStyle} />

      {/* Layer 5: Film-grain noise (inline SVG) */}
      <div className="absolute inset-0 pointer-events-none noise-layer" style={noiseStyle} />

      {/* Layer 6: Foreground hero content (optional) */}
      {showContent && (
        <div className="relative z-20 text-center max-w-5xl mx-auto p-8 content-foreground">
          <h1 className="hero-title">
            <span className="hero-gradient">Vector Intelligence</span>
          </h1>
          <p className="hero-sub">
            Designing at the intersection of 3D fidelity and dynamic user
            experience. This is excellence, redefined.
          </p>
          <div className="hero-cta">
            <button type="button" className="btn-primary">
              Initiate Launch
            </button>
            <button type="button" className="btn-ghost">
              View Geometric Mesh
            </button>
          </div>
        </div>
      )}

      {/* Final vignette */}
      <div className="absolute inset-0 pointer-events-none vignette-overlay" />
    </div>
  );
}
