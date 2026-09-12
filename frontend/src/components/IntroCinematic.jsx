import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

const introTitle = 'CINEMA JUNCTION // ANPR COMMAND';

export default function IntroCinematic({ onComplete }) {
  const overlayRef = useRef(null);
  const radarRef = useRef(null);
  const scanRef = useRef(null);
  const titleRefs = useRef([]);

  // Always hold the LATEST callback without the effect depending on its identity.
  // App passes a fresh inline arrow each render; depending on `onComplete` directly
  // would restart the timeline on every re-render and never complete the sequence.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const root = document.getElementById('root');
    const html = document.documentElement;
    const body = document.body;

    if (root) root.style.background = '#000000';
    if (html) html.style.background = '#000000';
    if (body) body.style.background = '#000000';
    if (body) body.style.overflow = 'hidden';

    // Guard against re-entrancy: only unmount once.
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (body) body.style.overflow = '';
      if (onCompleteRef.current) onCompleteRef.current();
    };

    // Safety net: guarantee the overlay is dismissed even if GSAP stalls/throws,
    // so the dashboard always renders underneath. Cleared on normal completion.
    const safetyTimer = window.setTimeout(() => {
      if (overlayRef.current) {
        overlayRef.current.style.pointerEvents = 'none';
        overlayRef.current.style.opacity = '0';
      }
      finish();
    }, 6000);

    const teardown = () => {
      window.clearTimeout(safetyTimer);
      gsap && gsap.killTweensOf([
        overlayRef.current,
        radarRef.current,
        scanRef.current,
        ...titleRefs.current,
      ]);
    };

    const play = () => {
      const timeline = gsap.timeline({
        defaults: { ease: 'power3.inOut' },
        onComplete: finish,
      });

      timeline
      .set(overlayRef.current, { opacity: 1, pointerEvents: 'auto' })
      .fromTo(
        radarRef.current,
        { opacity: 0, scale: 0.45, filter: 'drop-shadow(0 0 0 rgba(16,185,129,0))' },
        { opacity: 1, scale: 1, duration: 1.2, filter: 'drop-shadow(0 0 24px rgba(16,185,129,0.7))', ease: 'power3.out' },
        0
      )
      .fromTo(
        scanRef.current,
        { rotate: 0, opacity: 0.2 },
        { rotate: 360, opacity: 1, duration: 1.8, ease: 'none' },
        0
      )
      .fromTo(
        titleRefs.current,
        { opacity: 0, y: 28, filter: 'blur(10px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.45,
          stagger: 0.045,
          ease: 'power2.out',
        },
        0.8
      )
      .to(overlayRef.current, {
        opacity: 0,
        duration: 0.8,
        ease: 'power2.inOut',
        pointerEvents: 'none',
      }, 3.0);
    };

    try {
      play();
    } catch (err) {
      // If GSAP is unavailable or misconfigured, never let the screen stay black.
      finish();
    }

    return () => {
      teardown();
      if (body) body.style.overflow = '';
    };
  }, []); // Run exactly once on mount — never restart on parent re-renders.

  const titleChars = Array.from(introTitle);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black"
      style={{ backgroundColor: '#000000' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at center, rgba(16, 185, 129, 0.16) 0%, rgba(16, 185, 129, 0.06) 18%, rgba(0, 0, 0, 0) 56%)',
        }}
      />

      <div className="relative flex flex-col items-center justify-center">
        <div
          ref={radarRef}
          className="relative mb-10 flex items-center justify-center"
          style={{ width: 'clamp(220px, 28vw, 420px)', height: 'clamp(220px, 28vw, 420px)' }}
        >
          <svg
            viewBox="0 0 240 240"
            className="h-full w-full"
            aria-label="Emerald radar wireframe"
          >
            <g fill="none" stroke="rgba(16, 185, 129, 0.85)" strokeWidth="1.1">
              <circle cx="120" cy="120" r="95" />
              <circle cx="120" cy="120" r="72" />
              <circle cx="120" cy="120" r="48" />
              <circle cx="120" cy="120" r="22" />

              <line x1="120" y1="10" x2="120" y2="230" />
              <line x1="10" y1="120" x2="230" y2="120" />
              <line x1="30" y1="30" x2="210" y2="210" />
              <line x1="210" y1="30" x2="30" y2="210" />

              <path d="M120 120 L170 75" stroke="rgba(16, 185, 129, 0.9)" />
              <path d="M120 120 L165 155" stroke="rgba(16, 185, 129, 0.8)" />
              <path d="M120 120 L80 165" stroke="rgba(16, 185, 129, 0.8)" />
              <path d="M120 120 L75 85" stroke="rgba(16, 185, 129, 0.8)" />
            </g>

            <g ref={scanRef} style={{ transformOrigin: '120px 120px' }}>
              <path
                d="M120 10 A110 110 0 0 1 230 120"
                fill="none"
                stroke="rgba(16, 185, 129, 1)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M120 10 A110 110 0 0 1 220 58"
                fill="none"
                stroke="rgba(16, 185, 129, 0.25)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>

            <g fill="rgba(16,185,129,0.9)">
              <circle cx="120" cy="120" r="3.5" />
              <circle cx="170" cy="75" r="2.5" />
              <circle cx="165" cy="155" r="2.5" />
              <circle cx="80" cy="165" r="2.5" />
              <circle cx="75" cy="85" r="2.5" />
            </g>
          </svg>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-center text-center">
          {titleChars.map((char, index) => (
            <span
              key={`${char}-${index}`}
              ref={(element) => {
                titleRefs.current[index] = element;
              }}
              className="inline-block text-emerald-300"
              style={{
                fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
                fontSize: 'clamp(0.7rem, 1vw, 1.4rem)',
                letterSpacing: char === ' ' ? '0.45em' : '0.18em',
                textTransform: 'uppercase',
                lineHeight: 1.6,
                opacity: 0,
                whiteSpace: char === ' ' ? 'pre' : 'normal',
                transform: 'translateY(0px)',
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
