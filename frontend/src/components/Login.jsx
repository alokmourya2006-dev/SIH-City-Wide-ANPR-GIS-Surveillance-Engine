import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ShieldCheck, Lock, Eye, EyeOff, Bot, X, Loader2, ArrowRight } from 'lucide-react';
import WireframeDottedGlobe from './ui/wireframe-dotted-globe';
import GuideChat from './GuideChat';

/* ── Inspirational quotes for the typewriter ── */
const QUOTES = [
  'Precision protects. Intelligence prevails.',
  'Every plate tells a story — we read them all.',
  'One grid. One city. Zero blind spots.',
  'Vigilance is not a duty, it is a discipline.',
];

/* ── Credential field plumbing ──
   Layout lives in inline styles on purpose: they outrank every stylesheet
   rule (cascade layers, resets, future Tailwind changes), so the leading
   icon can never be pushed on top of the typed value again.

   Visual language: inset "console" wells — darker than the card, hairline
   border, cyan focus rail. Reads as a terminal input, not a web form. */
const FIELD_BOX =
  'group flex items-center rounded-2xl border border-slate-200 bg-white/80 ' +
  'shadow-[0_8px_26px_rgba(15,23,42,0.06)] transition-all duration-200 ' +
  'hover:border-slate-300 focus-within:border-violet-500 focus-within:bg-white ' +
  'focus-within:shadow-[0_0_0_4px_rgba(139,92,246,0.12)]';

const FIELD_BOX_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.8rem',
  paddingInline: '0.9rem',
  minWidth: 0,
  boxShadow: 'inset 0 1px 0 rgba(148,163,184,0.08)',
};

const FIELD_ICON_STYLE = { flex: '0 0 auto', lineHeight: 0 };

const FIELD_INPUT_STYLE = {
  flex: '1 1 auto',
  minWidth: 0,
  width: '100%',
  margin: 0,
  padding: 0,
  border: 0,
  background: 'transparent',
  outline: 'none',
  boxShadow: 'none',
  lineHeight: '1.35rem',
  paddingBlock: '0.8rem',
};

const LABEL = 'mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500';

const STATUS = 'font-mono text-[9.5px] uppercase tracking-[0.14em]';

export default function Login({ badgeIdInput, setBadgeIdInput, passwordInput, setPasswordInput, handleLogin, error }) {
  const [showPass, setShowPass] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState('');

  /* ── GSAP refs ── */
  const rootRef = useRef(null);
  const globeColRef = useRef(null);
  const qIdx = useRef(0);

  /* ── Typewriter: cycles inspirational quotes at the globe's base ── */
  useEffect(() => {
    let ch = 0;
    let dir = 1;
    let timer;
    const tick = () => {
      const q = QUOTES[qIdx.current % QUOTES.length];
      ch += dir;
      setQuote(q.slice(0, ch));
      let delay = dir > 0 ? 42 : 20;
      if (ch >= q.length) { dir = -1; delay = 2800; }
      else if (ch <= 0 && dir < 0) { dir = 1; qIdx.current += 1; delay = 600; }
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
  }, []);

  /* ── GSAP slow-motion globe shift (hover right ↔ leave) ──
     Only the globe container moves — the login card stays stable,
     so form inputs never shift under the user's cursor. */
  const shiftSplit = (towardGlobe) => {
    gsap.to(globeColRef.current, {
      x: towardGlobe ? 60 : 0,      // '+=60' style offset, absolute target for idempotent repeats
      duration: 1.2,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };

  // Professional submit: guard double-clicks, show spinner, always release.
  const onSubmit = async (e) => {
    if (busy) return;
    setBusy(true);
    try {
      await handleLogin(e);
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setBadgeIdInput('POLICE_7082');
    setPasswordInput('admin123');
  };

  return (
    <div
      ref={rootRef}
      className="relative flex min-h-screen w-full overflow-hidden bg-[linear-gradient(135deg,#201336_0%,#150f22_40%,#090b12_100%)]"
    >
      {/* Ambient backdrop behind both columns */}
      <div className="pointer-events-none absolute inset-0 opacity-25">
        <WireframeDottedGlobe className="pointer-events-none" width={900} height={720} />
      </div>

      {/* LEFT COLUMN: login form (stable — never shifts) */}
      <div className="relative z-10 flex w-full items-center justify-center px-5 py-10 lg:w-1/2">
        <div className="w-full max-w-[440px]">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))] p-[1px] shadow-[0_25px_80px_rgba(19,10,31,0.7)] backdrop-blur-xl">
            <div className="rounded-[27px] bg-[linear-gradient(180deg,rgba(112,75,157,0.92),rgba(48,31,72,0.95))] px-6 pb-6 pt-5 sm:px-7">
              <div className="mb-5 flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-violet-100 shadow-[0_0_30px_rgba(196,181,253,0.25)] ring-1 ring-white/10">
                  <ShieldCheck size={24} />
                </div>
              </div>
              <div className="mb-6 text-center">
                <h2 className="text-[27px] font-semibold tracking-[-0.04em] text-white">Police Surveillance Gateway</h2>
                <p className={'mt-2 text-violet-200/75 ' + STATUS}>Law enforcement access only</p>
              </div>
              {error && (
                <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2.5 text-[12.5px] leading-snug text-rose-100">
                  <span className="mt-[1px] shrink-0">!</span>
                  <span>{error}</span>
                </div>
              )}
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label htmlFor="badge" className={LABEL}>Badge ID</label>
                  <div className={FIELD_BOX} style={FIELD_BOX_STYLE}>
                    <span style={FIELD_ICON_STYLE} className="text-slate-400">
                      <ShieldCheck size={16} />
                    </span>
                    <input
                      id="badge"
                      type="text"
                      value={badgeIdInput}
                      onChange={(e) => setBadgeIdInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 14))}
                      placeholder="POLICE_7082"
                      autoComplete="username"
                      autoCapitalize="characters"
                      spellCheck={false}
                      style={FIELD_INPUT_STYLE}
                      className="font-mono text-[15px] font-semibold tracking-[0.08em] text-slate-900 placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                    />
                    <span className={STATUS + ' shrink-0 text-slate-400'}>{(badgeIdInput || '').length}/14</span>
                  </div>
                </div>
                <div>
                  <label htmlFor="pass" className={LABEL}>Passcode</label>
                  <div className={FIELD_BOX} style={FIELD_BOX_STYLE}>
                    <span style={FIELD_ICON_STYLE} className="text-slate-400">
                      <Lock size={16} />
                    </span>
                    <input
                      id="pass"
                      type={showPass ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      onKeyUp={(e) => setCapsOn(e.getModifierState && e.getModifierState('CapsLock'))}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      style={FIELD_INPUT_STYLE}
                      className="text-[15px] tracking-[0.28em] text-slate-900 placeholder:tracking-[0.28em] placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      aria-label={showPass ? 'Hide passcode' : 'Show passcode'}
                      className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-900/5 hover:text-violet-700"
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {capsOn && <p className={'mt-1.5 text-right text-amber-500 ' + STATUS}>caps lock on</p>}
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c3aed,#5b21b6)] py-3.5 text-[14.5px] font-semibold text-white shadow-[0_10px_34px_rgba(124,58,237,0.4)] transition hover:shadow-[0_12px_44px_rgba(124,58,237,0.55)] disabled:cursor-wait disabled:opacity-70"
                >
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> Authenticating…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Lock size={14} /> Authenticate Session
                      <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                    </span>
                  )}
                </button>
                <p className={'pt-1 text-center text-violet-200/60 ' + STATUS}>
                  Press Enter to submit · attempts are audited
                                </p>
              </form>
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                <span className={'text-violet-200/70 ' + STATUS}>Demo access</span>
                <button
                  type="button"
                  onClick={fillDemo}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-violet-100 transition hover:border-violet-300/60 hover:text-white"
                >
                  Autofill credentials
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* RIGHT COLUMN: rotating globe + typewriter quote */}
      <div
        ref={globeColRef}
        onMouseEnter={() => shiftSplit(true)}
        onMouseLeave={() => shiftSplit(false)}
        className="relative hidden w-1/2 items-center justify-center overflow-hidden lg:flex"
      >
        <div className="relative h-[560px] w-[560px] max-w-[80vw] animate-[spin_140s_linear_infinite]">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_60%)] blur-2xl" />
          <div className="absolute inset-[10%] rounded-full border border-violet-200/10 bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.08),transparent_60%)]" />
          <WireframeDottedGlobe className="pointer-events-none absolute inset-0" width={900} height={720} />
        </div>
        <div className="absolute bottom-[7%] left-1/2 w-[86%] -translate-x-1/2 text-center">
          <p className="min-h-[3.4rem] font-mono text-[13px] leading-relaxed tracking-wide text-violet-100/90">
            {quote}
            <span className="ml-1 inline-block h-[1.05em] w-[2px] animate-pulse bg-violet-300 align-[-0.15em]" />
          </p>
          <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.3em] text-violet-300/50">
            Argus // Secure Mesh
          </p>
        </div>
      </div>
      {/* Website assistant (GuideChat) */}
      <div className="absolute bottom-5 right-5 z-20 flex flex-col items-end gap-2.5">
        {assistantOpen && (
          <div className="login-rise w-[min(360px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-violet-300/20 bg-slate-950/90 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="h-[440px] max-h-[60vh]">
              <GuideChat onClose={() => setAssistantOpen(false)} />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setAssistantOpen((o) => !o)}
          aria-label={assistantOpen ? 'Close assistant' : 'Open website assistant'}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f5d0fe,#c4b5fd)] text-violet-950 shadow-[0_0_30px_rgba(196,181,253,0.45)] transition hover:scale-105 active:scale-95"
        >
          {assistantOpen ? <X size={22} /> : <Bot size={24} />}
          {!assistantOpen && <span className="absolute inset-0 animate-ping rounded-full bg-violet-300/20" />}
        </button>
        {!assistantOpen && (
          <span className="rounded-full border border-violet-300/25 bg-slate-950/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-violet-100 backdrop-blur-sm">
            Website assistant
          </span>
        )}
      </div>
    </div>
  );
}
