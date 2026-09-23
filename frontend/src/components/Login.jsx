import React, { useState } from 'react';
import { ShieldCheck, BadgeCheck, Lock, Eye, EyeOff, Bot, X, ChevronLeft, Loader2, ArrowRight, KeyRound } from 'lucide-react';
import WireframeDottedGlobe from './ui/wireframe-dotted-globe';
import GuideChat from './GuideChat';

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
  const [revealed, setRevealed] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [busy, setBusy] = useState(false);

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
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(109,40,217,0.34),_transparent_28%),linear-gradient(135deg,#201336_0%,#150f22_40%,#090b12_100%)] px-4 py-10"
      onMouseEnter={() => setRevealed(true)}
    >
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <WireframeDottedGlobe className="pointer-events-none" width={900} height={720} />
      </div>

      {!revealed && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute left-1/2 top-[8%] -translate-x-1/2 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-violet-200/80">Argus // Secure Mesh</p>
            <h1 className="login-display-font mt-3 whitespace-nowrap text-4xl font-bold text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)] sm:text-5xl">
              Vector Intelligence
            </h1>
          </div>
          <div
            role="button"
            tabIndex={0}
            aria-label="Reveal login"
            onMouseEnter={() => setRevealed(true)}
            onClick={() => setRevealed(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setRevealed(true); }}
            className="pointer-events-auto absolute bottom-[7%] left-1/2 inline-flex -translate-x-1/2 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-violet-300/30 bg-white/8 px-7 py-3.5 text-sm font-semibold text-violet-50 shadow-[0_0_30px_rgba(196,181,253,0.2)] backdrop-blur-md transition duration-200 hover:border-violet-200/80 hover:bg-white/12"
          >
            Hover / Tap to Authenticate
          </div>
        </div>
      )}

      {revealed && (
        <div className="relative z-10 w-full max-w-[1200px]">
          <div className="flex items-center justify-center gap-10 lg:gap-16">
            <div className={`w-full max-w-[470px] transition-all duration-700 ease-out ${revealed ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'}`}>
              <button
                type="button"
                onClick={() => setRevealed(false)}
                className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-violet-100 backdrop-blur-md transition hover:border-violet-200/60 hover:text-white"
              >
                <ChevronLeft size={13} /> Back
              </button>

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
                      <X size={13} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={onSubmit} autoComplete="off" className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label htmlFor="badge-id" className={LABEL}>Badge ID</label>
                        <span className={LABEL + ' tracking-[0.1em]'}>{badgeIdInput.length}/14</span>
                      </div>
                      <div className={FIELD_BOX} style={FIELD_BOX_STYLE}>
                        <span className="text-violet-600" style={FIELD_ICON_STYLE}><BadgeCheck size={16} /></span>
                        <input
                          id="badge-id"
                          value={badgeIdInput}
                          onChange={(e) => setBadgeIdInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                          maxLength={14}
                          placeholder="POLICE_XXXX"
                          spellCheck={false}
                          autoFocus
                          autoComplete="username"
                          className="font-mono text-[14px] tracking-[0.14em] text-slate-900 caret-violet-600 placeholder:tracking-[0.14em] placeholder:text-slate-400"
                          style={FIELD_INPUT_STYLE}
                        />
                      </div>
                      <p className={'mt-2 text-slate-500 ' + STATUS}>Uppercase · alphanumeric + underscore</p>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label htmlFor="passcode" className={LABEL}>Passcode</label>
                        <span className={LABEL + ' tracking-[0.1em]'}>{capsOn ? 'Caps' : 'Secure'}</span>
                      </div>
                      <div className={FIELD_BOX} style={FIELD_BOX_STYLE}>
                        <span className="text-violet-600" style={FIELD_ICON_STYLE}><KeyRound size={15} /></span>
                        <input
                          id="passcode"
                          type={showPass ? 'text' : 'password'}
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          onKeyUp={(e) => setCapsOn(e.getModifierState && e.getModifierState('CapsLock'))}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="text-[14px] tracking-[0.28em] text-slate-900 caret-violet-600 placeholder:tracking-[0.28em] placeholder:text-slate-400"
                          style={FIELD_INPUT_STYLE}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass((s) => !s)}
                          aria-label={showPass ? 'Hide passcode' : 'Show passcode'}
                          className="-mr-1 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-violet-600"
                          style={FIELD_ICON_STYLE}
                        >
                          {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <p className={'text-slate-500 ' + STATUS}>{showPass ? 'Passcode visible' : 'Masked input'}</p>
                        {capsOn && <p className={STATUS + ' text-amber-600'}>⚠ caps lock on</p>}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#ffffff,#e9d5ff)] px-5 py-3.5 text-[12.5px] font-bold uppercase tracking-[0.22em] text-violet-900 shadow-[0_12px_30px_rgba(255,255,255,0.22)] transition hover:scale-[1.01] hover:shadow-[0_18px_36px_rgba(196,181,253,0.28)] active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
                    >
                      {busy ? (
                        <><Loader2 size={15} className="animate-spin" /> Authenticating…</>
                      ) : (
                        <>
                          <Lock size={14} /> Authenticate Session
                          <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                        </>
                      )}
                    </button>

                    <p className={'pt-1 text-center text-slate-500 ' + STATUS}>
                      Press Enter to submit · attempts are audited
                    </p>
                  </form>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-200/70 pt-4">
                    <span className={'text-slate-500 ' + STATUS}>Demo access</span>
                    <button
                      type="button"
                      onClick={fillDemo}
                      className="rounded-full border border-slate-200 bg-white/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-700 transition hover:border-violet-300 hover:text-violet-700"
                    >
                      Autofill credentials
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className={`pointer-events-none relative flex-1 transition-all duration-700 ease-out ${revealed ? 'translate-x-6 scale-[1.02]' : 'translate-x-0 scale-100'}`}>
              <div className="mx-auto flex max-w-[560px] items-center justify-center">
                <div className="relative h-[560px] w-[560px] max-w-[72vw]">
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_60%)] blur-2xl" />
                  <div className="absolute inset-[10%] rounded-full border border-violet-200/10 bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.08),transparent_60%)]" />
                  <div className="absolute inset-0">
                    <WireframeDottedGlobe className="pointer-events-none" width={900} height={720} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {revealed && (
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
      )}
    </div>
  );
}

