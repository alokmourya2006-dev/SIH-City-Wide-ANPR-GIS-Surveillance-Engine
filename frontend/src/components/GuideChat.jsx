import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, X } from 'lucide-react';

const KNOW = [
  ['who can|who use|authorized|eligib|allowed', 'Only authorized law-enforcement personnel can use ARGUS — police officers, traffic staff and command-centre operators with an issued Badge ID. Not for the general public.'],
  ['cannot|not allowed|not use|public|civilian|not police|non-police|outsider', 'No — civilians cannot log in. ARGUS holds live ANPR surveillance data, so access is restricted to verified police accounts only. Unauthorized attempts are logged and blocked.'],
  ['rule|policy|regulation|guideline|misuse|audit|logged', 'Rules: 1) Login only with your issued Badge ID — never share it. 2) Every search and view is audit-logged. 3) Use data for official duty only. 4) Log out on shared PCs. 5) No fake hotlist entries.'],
  ['login|badge|passcode|password|sign in|authenticate', 'Enter Badge ID (e.g. POLICE_7082) and Passcode (e.g. admin123), then press Authenticate Session. Backend must run at 127.0.0.1:8000.'],
  ['search|vehicle|plate|number|find car|track', 'After login open Search, type the plate (e.g. UP32KT2112), pick dates, press Search. Hits appear as list + GIS map pins.'],
  ['hotlist|watchlist|wanted|alert', 'Hotlist = wanted vehicles. Open it from the top bar, add plate + reason + severity. Matching ANPR sightings raise instant alerts.'],
  ['camera|live|feed|cam-', 'Cameras page shows the 1,247-node grid. Press LIVE CAM (CAM-01 Hazratganj default) for live feed + ANPR overlay.'],
  ['dashboard|home|overview', 'Dashboard is home after login — live alerts, detections count, hotlist hits, camera health.'],
  ['what can|features|website do|how to use|help|what is argus|about', 'ARGUS does 3 things: 1) Dashboard — alerts + stats. 2) Search — find vehicles on GIS map. 3) Cameras — grid + live feed. Ask me any!'],
  ['backend|failed to fetch|error|not working|connection', 'If login says Failed to fetch: backend is down. Run: cd backend, python -m uvicorn app.main:app --host 127.0.0.1 --port 8000. Then refresh.'],
  ['logout|log out|sign out|exit', 'Press Logout in the top bar after duty. Always log out on shared computers.'],
  ['who are you|your name|assistant', 'I am the ARGUS website assistant — I know every rule: who may use it, who may not, and how login, search, hotlist, cameras work.'],
  ['hi|hello|hey|namaste', 'Hello officer! Ask me: who can use this site, the rules, how to login, or how to search a vehicle.'],
];

function botReply(q) {
  const s = q.toLowerCase();
  for (const [keys, ans] of KNOW) {
    if (keys.split('|').some((k) => s.includes(k))) return ans;
  }
  return 'I help with: who can use ARGUS, rules, login, search, hotlist, cameras. Tap a suggestion or type your question.';
}

const SUGS = ['Who can use this?', 'Platform rules?', 'Search a vehicle?', 'How do I login?'];

export default function GuideChat({ onClose }) {
  const [msgs, setMsgs] = useState([
    { from: 'bot', text: 'Hi, I am the ARGUS assistant. Ask who can use this site, the rules, or how to login / search.' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const boxRef = useRef(null);
  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; }, [msgs, typing]);
  const send = (t) => {
    const q = (t ?? input).trim();
    if (!q || typing) return;
    setMsgs((m) => [...m, { from: 'user', text: q }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setMsgs((m) => [...m, { from: 'bot', text: botReply(q) }]);
      setTyping(false);
    }, 500);
  };
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950">
      <div className="flex items-center gap-2.5 border-b border-white/10 bg-slate-900/80 px-4 py-3">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 text-white">
          <Bot size={17} />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">ARGUS Assistant</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">online - replies instantly</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close assistant" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-cyan-200">
            <X size={15} />
          </button>
        )}
      </div>
      <div ref={boxRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3" style={{ maxHeight: 340 }}>
        {msgs.map((m, i) => (
          <div key={i} className={'flex gap-2 ' + (m.from === 'user' ? 'justify-end' : 'justify-start')}>
            {m.from === 'bot' && (<span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300"><Bot size={12} /></span>)}
            <p className={'max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ' + (m.from === 'user' ? 'rounded-br-sm bg-cyan-500/20 text-cyan-50' : 'rounded-bl-sm bg-slate-800/90 text-slate-200')}>{m.text}</p>
            {m.from === 'user' && (<span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-300"><User size={12} /></span>)}
          </div>
        ))}
        {typing && (<p className="font-mono text-[11px] text-cyan-300/70">assistant is typing...</p>)}
      </div>
      <div className="flex flex-wrap gap-1.5 px-3.5 pb-2">
        {SUGS.map((s) => (
          <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200 hover:bg-cyan-500/20">{s}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 border-t border-white/10 p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the assistant..." className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400" />
        <button type="submit" aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:brightness-110"><Send size={16} /></button>
      </form>
    </div>
  );
}