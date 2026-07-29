import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  Paperclip,
  X,
  AlertTriangle,
  Check,
  Send,
  FileText,
  Heart,
  MessageCircle,
  Image as ImageIcon,
  Home,
  PenSquare,
} from "lucide-react";

/* ------------------------------------------------------------------
   Platform rule table — single source of truth for constraints.
------------------------------------------------------------------ */
const PLATFORMS = {
  twitter: { label: "Twitter / X", code: "TWX", ink: "#1D6FA5", charLimit: 280, maxHashtags: null, maxMedia: 4 },
  instagram: { label: "Instagram", code: "IG", ink: "#A6295B", charLimit: 2200, maxHashtags: 30, maxMedia: 10, mediaRequired: true },
  linkedin: { label: "LinkedIn", code: "LI", ink: "#1E5C8C", charLimit: 3000, maxHashtags: 5, maxMedia: 9 },
  facebook: { label: "Facebook", code: "FB", ink: "#2C4C8C", charLimit: 63206, maxHashtags: null, maxMedia: 10, softLimit: 500 },
};
const PLATFORM_KEYS = Object.keys(PLATFORMS);

function validateForPlatform(key, text, mediaCount) {
  const rules = PLATFORMS[key];
  const issues = [];
  const hashtagCount = (text.match(/#[\p{L}0-9_]+/gu) || []).length;

  if (text.trim().length === 0) issues.push({ level: "error", msg: "Post is empty." });
  if (text.length > rules.charLimit) {
    issues.push({ level: "error", msg: `${text.length - rules.charLimit} characters over the ${rules.charLimit.toLocaleString()} limit.` });
  } else if (rules.softLimit && text.length > rules.softLimit) {
    issues.push({ level: "warn", msg: `Past ${rules.softLimit} characters, this gets truncated with "See more" in feed.` });
  }
  if (rules.maxHashtags && hashtagCount > rules.maxHashtags) {
    issues.push({ level: "error", msg: `${hashtagCount} hashtags used, max is ${rules.maxHashtags}.` });
  }
  if (rules.mediaRequired && mediaCount === 0) {
    issues.push({ level: "error", msg: "Instagram requires at least one image or video." });
  }
  if (mediaCount > rules.maxMedia) {
    issues.push({ level: "error", msg: `${mediaCount} attachments, max is ${rules.maxMedia}.` });
  }
  return { issues, hashtagCount };
}

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');`;
const PAPER = "#F5F1E6";
const INK = "#22262B";
const NAVY = "#1E3A5F";
const GOLD = "#C7973B";
const LINE = "#C9BFA5";
const MUTED = "#8B8478";
const RUST = "#A63D2F";

/* ------------------------------------------------------------------
   Toast — confirmation slip shown after a successful dispatch
------------------------------------------------------------------ */
function Toast({ toast }) {
  return (
    <div
      className="fixed top-4 left-1/2 z-50 flex items-center gap-3 rounded-md border-2 pl-3 pr-4 py-3 shadow-lg transition-all duration-300"
      style={{
        background: "#FFFFFF",
        borderColor: NAVY,
        borderStyle: "dashed",
        transform: toast.show ? "translate(-50%, 0)" : "translate(-50%, -140%)",
        opacity: toast.show ? 1 : 0,
        maxWidth: "90vw",
      }}
      role="status"
      aria-live="polite"
    >
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{ background: NAVY }}
      >
        <Check size={15} color={PAPER} strokeWidth={3} />
      </span>
      <div>
        <div className="text-[11px] font-bold tracking-[0.08em]" style={{ color: INK, fontFamily: "'IBM Plex Mono', monospace" }}>
          POST DISPATCHED
        </div>
        <div className="text-[11.5px] mt-0.5" style={{ color: MUTED }}>{toast.message}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Postmark badge — per-platform character meter
------------------------------------------------------------------ */
function Postmark({ used, limit, ink }) {
  const pct = Math.min(used / limit, 1);
  const over = used > limit;
  const dashTotal = 28;
  const dashFilled = Math.round(pct * dashTotal);
  const color = over ? RUST : pct > 0.9 ? GOLD : ink;
  const remaining = limit - used;

  return (
    <div className="relative w-10 h-10 shrink-0" title={`${used}/${limit}`}>
      <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
        {Array.from({ length: dashTotal }).map((_, i) => {
          const angle = (i / dashTotal) * 2 * Math.PI;
          const x1 = 20 + 15 * Math.cos(angle);
          const y1 = 20 + 15 * Math.sin(angle);
          const x2 = 20 + 18 * Math.cos(angle);
          const y2 = 20 + 18 * Math.sin(angle);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={i < dashFilled ? color : "#DCD5C4"} strokeWidth="2" strokeLinecap="round" />
          );
        })}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums"
        style={{ color: over ? RUST : INK, fontFamily: "'IBM Plex Mono', monospace" }}>
        {limit > 5000 ? "\u221E" : Math.abs(remaining) > 999 ? "999+" : remaining}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------
   Stamp-style platform toggle
------------------------------------------------------------------ */
function StampChip({ pKey, selected, onToggle, tilt }) {
  const p = PLATFORMS[pKey];
  return (
    <button type="button" onClick={() => onToggle(pKey)} aria-pressed={selected}
      style={{
        transform: `rotate(${selected ? 0 : tilt}deg)`,
        borderColor: selected ? p.ink : LINE,
        color: selected ? p.ink : MUTED,
        background: selected ? "#FFFFFF" : "#EFE9D8",
      }}
      className="relative flex flex-col items-center justify-center gap-0.5 rounded-sm border-2 border-dashed px-3 py-2 min-w-[76px] transition-all duration-150 hover:-translate-y-0.5">
      <span className="text-[9px] tracking-[0.15em] font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{p.code}</span>
      <span className="text-[10px] font-medium leading-tight text-center">{p.label}</span>
      {selected && (
        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: p.ink }}>
          <Check size={9} color={PAPER} strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------
   Header — brand mark + Home / Compose navigation
------------------------------------------------------------------ */
function Header({ page, setPage }) {
  const NavTab = ({ id, icon: Icon, label }) => {
    const active = page === id;
    return (
      <button
        type="button"
        onClick={() => setPage(id)}
        className="relative flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-colors"
        style={{ color: active ? NAVY : MUTED, fontFamily: "'IBM Plex Mono', monospace" }}
      >
        <Icon size={13} />
        {label}
        {active && <span className="absolute -bottom-[9px] left-2 right-2 h-[2px] rounded-full" style={{ background: NAVY }} />}
      </button>
    );
  };

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b-2 border-dashed"
      style={{ background: PAPER, borderColor: LINE }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center" style={{ borderColor: GOLD }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-tight leading-none" style={{ color: INK, fontFamily: "'IBM Plex Mono', monospace" }}>
            POSTIFY
          </div>
          <div className="text-[9px] tracking-[0.2em] mt-0.5" style={{ color: GOLD, fontFamily: "'IBM Plex Mono', monospace" }}>
            DISPATCH COMPOSER
          </div>
        </div>
      </div>
      <nav className="flex items-center gap-1 pb-[9px]">
        <NavTab id="home" icon={Home} label="HOME" />
        <NavTab id="compose" icon={PenSquare} label="COMPOSE" />
      </nav>
    </header>
  );
}

/* ------------------------------------------------------------------
   Stat card for the dashboard
------------------------------------------------------------------ */
function StatCard({ icon: Icon, label, value, ink }) {
  return (
    <div className="rounded-md border-2 border-dashed px-4 py-4 flex flex-col gap-3" style={{ borderColor: LINE, background: "#FFFFFF" }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${ink}18` }}>
        <Icon size={15} color={ink} />
      </div>
      <div>
        <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color: INK, fontFamily: "'IBM Plex Mono', monospace" }}>
          {value.toLocaleString()}
        </div>
        <div className="text-[11px] mt-1.5" style={{ color: MUTED }}>{label}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Home / Dashboard page
------------------------------------------------------------------ */
function HomePage({ setPage, stats }) {
  const features = [
    { title: "Compose once", body: "Write a single draft and route it to every platform you've connected." },
    { title: "Validate live", body: "Character limits, hashtag caps, and media rules are checked as you type." },
    { title: "Attach freely", body: "Add images or video to any post — nothing is required to dispatch." },
    { title: "Track results", body: "Posts, likes, comments, and media all roll up here on your dashboard." },
  ];

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <div className="mb-8">
        <div className="text-[10px] tracking-[0.2em] font-bold mb-2" style={{ color: GOLD, fontFamily: "'IBM Plex Mono', monospace" }}>
          WELCOME
        </div>
        <h1 className="text-[22px] font-bold" style={{ color: INK }}>What Postify does</h1>
        <p className="text-[13px] mt-2 leading-relaxed max-w-xl" style={{ color: MUTED }}>
          Postify is a single composer for posts bound for several social platforms at once. Pick your
          destinations, draft your message, and Postify checks it against each platform's rules in real time —
          then this dashboard keeps a running total of what you've sent out.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-9">
        {features.map((f) => (
          <div key={f.title} className="rounded-md border-2 border-dashed px-4 py-3.5" style={{ borderColor: LINE, background: "#FFFFFF" }}>
            <div className="text-[12px] font-bold mb-1" style={{ color: NAVY }}>{f.title}</div>
            <div className="text-[11.5px] leading-relaxed" style={{ color: MUTED }}>{f.body}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-bold" style={{ color: INK }}>Your dashboard</h2>
        <button
          type="button"
          onClick={() => setPage("compose")}
          className="flex items-center gap-1.5 text-[11px] font-bold rounded-full px-3.5 py-1.5 border-2 transition-all duration-150 active:scale-95"
          style={{ borderColor: NAVY, background: NAVY, color: PAPER, fontFamily: "'IBM Plex Mono', monospace" }}
        >
          <PenSquare size={12} /> NEW POST
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={FileText} label="Total posts" value={stats.totalPosts} ink={NAVY} />
        <StatCard icon={Heart} label="Total likes" value={stats.totalLikes} ink={RUST} />
        <StatCard icon={MessageCircle} label="Total comments" value={stats.totalComments} ink="#1E5C8C" />
        <StatCard icon={ImageIcon} label="Media uploaded" value={stats.totalMedia} ink={GOLD} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Compose page
------------------------------------------------------------------ */
function ComposePage({ onDispatch }) {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState(["twitter", "instagram"]);
  const [media, setMedia] = useState([]);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const fileRef = useRef(null);

  const togglePlatform = useCallback((key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const handleFiles = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    setMedia((prev) => [...prev, ...files.map((f, i) => ({ id: `${Date.now()}-${i}`, name: f.name }))]);
    e.target.value = "";
  }, []);

  const removeMedia = useCallback((id) => setMedia((prev) => prev.filter((m) => m.id !== id)), []);

  const report = useMemo(() => {
    const out = {};
    for (const key of selected) out[key] = validateForPlatform(key, text, media.length);
    return out;
  }, [selected, text, media.length]);

  const totalErrors = useMemo(
    () => Object.values(report).reduce((sum, r) => sum + r.issues.filter((i) => i.level === "error").length, 0),
    [report]
  );

  const canPost = selected.length > 0 && totalErrors === 0 && !posting;

  const handlePost = () => {
    if (!canPost) return;
    setPosting(true);
    setTimeout(() => {
      setPosting(false);
      setPosted(true);
      onDispatch({
        platformCount: selected.length,
        mediaCount: media.length,
        platformLabels: selected.map((k) => PLATFORMS[k].label),
      });
      setText("");
      setMedia([]);
      setTimeout(() => setPosted(false), 2200);
    }, 850);
  };

  return (
    <div className="max-w-xl mx-auto px-5 py-7">
      <div
        className="w-full rounded-md overflow-hidden shadow-sm border-2 border-dashed"
        style={{ background: "#FFFFFF", borderColor: LINE }}
      >
        <div className="px-5 pt-4 pb-3 flex items-baseline justify-between border-b-2 border-dashed" style={{ borderColor: LINE }}>
          <h2 className="text-[13px] font-semibold" style={{ color: INK }}>Compose</h2>
          <span className="text-[9px] tracking-[0.15em] font-bold" style={{ color: MUTED, fontFamily: "'IBM Plex Mono', monospace" }}>
            {selected.length} ROUTE{selected.length !== 1 ? "S" : ""}
          </span>
        </div>

        <div className="px-5 pt-4 flex flex-wrap gap-3">
          {PLATFORM_KEYS.map((k, i) => (
            <StampChip key={k} pKey={k} selected={selected.includes(k)} onToggle={togglePlatform} tilt={i % 2 === 0 ? -3 : 3} />
          ))}
        </div>

        <div className="px-5 pt-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Draft your message..."
            rows={5}
            className="w-full resize-none rounded-sm border-2 px-3.5 py-3 text-[14px] leading-relaxed outline-none focus:border-solid transition-colors"
            style={{ borderColor: LINE, borderStyle: "dashed", color: INK, background: PAPER }}
          />
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
              {selected.map((k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <Postmark used={text.length} limit={PLATFORMS[k].charLimit} ink={PLATFORMS[k].ink} />
                  <span className="text-[10px]" style={{ color: MUTED }}>{PLATFORMS[k].label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-[11px] font-semibold rounded-sm border-2 border-dashed px-2.5 py-1.5 hover:bg-stone-50 transition-colors"
              style={{ borderColor: LINE, color: INK }}>
              <Paperclip size={12} /> Attach media
            </button>
            <input ref={fileRef} type="file" multiple hidden onChange={handleFiles} accept="image/*,video/*" />
            {media.map((m) => (
              <span key={m.id} className="flex items-center gap-1 text-[10px] rounded-sm pl-2 pr-1 py-1 border"
                style={{ borderColor: LINE, color: INK, background: PAPER }}>
                {m.name.length > 14 ? m.name.slice(0, 12) + "\u2026" : m.name}
                <button onClick={() => removeMedia(m.id)} className="hover:text-red-700" aria-label={`Remove ${m.name}`}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {selected.length > 0 && (
          <div className="px-5 pt-4 space-y-2">
            {selected.map((k) => {
              const r = report[k];
              if (r.issues.length === 0) return null;
              return (
                <div key={k} className="rounded-sm border-l-4 pl-3 py-1.5" style={{ borderColor: PLATFORMS[k].ink, background: PAPER }}>
                  <div className="text-[9px] font-bold tracking-[0.1em] mb-1" style={{ color: PLATFORMS[k].ink, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {PLATFORMS[k].code}
                  </div>
                  <ul className="space-y-1">
                    {r.issues.map((iss, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-[11.5px]" style={{ color: iss.level === "error" ? RUST : "#9A6B1E" }}>
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                        {iss.msg}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-5 py-4 mt-3 flex items-center justify-between border-t-2 border-dashed" style={{ borderColor: LINE }}>
          <div className="text-[10px]" style={{ color: MUTED }}>
            {selected.length === 0 ? "Select a route to dispatch to." : "Ready when every route checks out."}
          </div>
          <button type="button" onClick={handlePost} disabled={!canPost}
            className="flex items-center gap-1.5 text-[12px] font-bold rounded-full px-4 py-2 border-2 transition-all duration-150 active:scale-95"
            style={{
              borderColor: canPost ? NAVY : LINE,
              background: canPost ? NAVY : "transparent",
              color: canPost ? PAPER : MUTED,
              cursor: canPost ? "pointer" : "not-allowed",
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
            {posting ? "STAMPING\u2026" : posted ? (<><Check size={13} /> SENT</>) : (<><Send size={13} /> DISPATCH</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   App shell — header + page switch + shared stats
------------------------------------------------------------------ */
export default function App() {
  const [page, setPage] = useState("home");
  const [stats, setStats] = useState({
    totalPosts: 128,
    totalLikes: 4390,
    totalComments: 812,
    totalMedia: 214,
  });
  const [toast, setToast] = useState({ show: false, message: "" });
  const toastTimer = useRef(null);

  const handleDispatch = useCallback(({ platformCount, mediaCount, platformLabels }) => {
    setStats((prev) => ({
      totalPosts: prev.totalPosts + platformCount,
      totalLikes: prev.totalLikes + Math.floor(Math.random() * 40 + 10) * platformCount,
      totalComments: prev.totalComments + Math.floor(Math.random() * 10 + 2) * platformCount,
      totalMedia: prev.totalMedia + mediaCount,
    }));
    setPage("home");

    const names = platformLabels || [];
    const message =
      names.length <= 2
        ? `Live on ${names.join(" and ")}.`
        : `Live on ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}.`;

    clearTimeout(toastTimer.current);
    setToast({ show: true, message });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3200);
  }, []);

  return (
    <div className="w-full min-h-full" style={{ background: PAPER, fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui" }}>
      <style>{FONT_IMPORT}</style>
      <Toast toast={toast} />
      <Header page={page} setPage={setPage} />
      {page === "home" ? <HomePage setPage={setPage} stats={stats} /> : <ComposePage onDispatch={handleDispatch} />}
    </div>
  );
}
