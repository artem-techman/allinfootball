"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EmailSignIn } from "@/components/club/EmailSignIn";
import { MAX_BODY, type ChatMessage, type ChatState } from "@/lib/pep/chatModel";

/**
 * Community chat beside Pep's office. Everyone can read; signed-in fans pick a
 * chat name once and talk; Pep answers from his shift. Polls every 8s while
 * the tab is visible. Messages render as plain text (no links, no HTML).
 */
const POLL_MS = 8_000;

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });

export function PepChat({ onShift, demo }: { onShift: boolean; demo?: ChatState }) {
  const [state, setState] = useState<ChatState | null>(demo ?? null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const load = async () => {
    try {
      const res = await fetch("/api/pep/chat", { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } catch {
      /* keep what we have */
    }
  };

  useEffect(() => {
    if (demo) return;
    load();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!document.hidden) await load();
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    const onVisible = () => !document.hidden && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [demo]);

  // Keep the newest message in view unless the reader scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [state?.messages.length]);

  const byId = useMemo(() => new Map((state?.messages ?? []).map((m) => [m.id, m])), [state?.messages]);
  const me = state?.me;
  const needsName = Boolean(me?.signedIn && !me.name);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pep/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, replyTo: replyTo?.id, ...(needsName ? { name } : {}) }),
      });
      const r = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: ChatMessage; name?: string };
      if (r.ok && r.message) {
        stick.current = true;
        setState((s) => (s ? { ...s, me: { signedIn: true, name: r.name ?? s.me.name }, messages: [...s.messages, r.message!] } : s));
        setText("");
        setReplyTo(null);
      } else setError(r.error ?? "Couldn't send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-card border border-hairline bg-[#0b0d11]" aria-labelledby="pep-chat">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3.5 py-3">
        <div>
          <h2 id="pep-chat" className="pixel text-[10px] leading-none text-[#d9ff3f]">
            COMMUNITY CHAT
          </h2>
          <p className="mt-1.5 text-[11px] text-text-muted">Talk football with Pep and other fans</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${onShift ? "bg-[#d9ff3f]/10 text-[#d9ff3f]" : "bg-white/5 text-text-muted"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${onShift ? "bg-[#d9ff3f] pep-pulse" : "bg-white/30"}`} />
          {onShift ? "Pep is here" : "Pep is away"}
        </span>
      </header>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3 [scrollbar-width:thin]"
        aria-live="polite"
      >
        {!state ? (
          <p className="py-8 text-center text-meta text-text-muted">Loading the chat…</p>
        ) : state.messages.length === 0 ? (
          <p className="py-8 text-center text-meta text-text-muted">No messages yet. Say hello to football&apos;s first AI CEO.</p>
        ) : (
          state.messages.map((m) => (
            <Message key={m.id} m={m} quoted={m.replyTo ? byId.get(m.replyTo) : undefined} canReply={Boolean(me?.signedIn)} onReply={() => setReplyTo(m)} />
          ))
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        {!state ? null : me?.signedIn ? (
          <form onSubmit={send} className="space-y-2">
            {needsName && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="Pick your chat name"
                className="w-full rounded-[8px] border border-white/10 bg-white/5 px-3 py-2 text-meta text-white placeholder:text-text-muted focus:border-[#d9ff3f]/60 focus:outline-none"
                aria-label="Chat name"
              />
            )}
            {replyTo && (
              <div className="flex items-center gap-2 rounded-[8px] bg-white/5 px-2.5 py-1.5 text-[11px] text-text-secondary">
                <span className="min-w-0 flex-1 truncate">
                  Replying to <b className="text-white">{replyTo.author}</b>: {replyTo.body}
                </span>
                <button type="button" onClick={() => setReplyTo(null)} className="shrink-0 text-text-muted hover:text-white" aria-label="Cancel reply">
                  ✕
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                  }
                }}
                rows={1}
                maxLength={MAX_BODY}
                placeholder={onShift ? "Ask Pep anything…" : "Leave Pep a message…"}
                className="max-h-28 min-h-[38px] flex-1 resize-none rounded-[8px] border border-white/10 bg-white/5 px-3 py-2 text-meta text-white placeholder:text-text-muted focus:border-[#d9ff3f]/60 focus:outline-none"
                aria-label="Message"
              />
              <button
                type="submit"
                disabled={busy || !text.trim() || (needsName && name.trim().length < 2)}
                className="pixel h-[38px] shrink-0 rounded-[8px] bg-[#d9ff3f] px-3 text-[9px] text-[#0b0d11] disabled:opacity-40"
              >
                SEND
              </button>
            </div>
            {error && <p className="text-[11px] text-[#f87171]">{error}</p>}
            <p className="text-[10px] text-text-muted">Public chat. Be kind. Pep answers when he&apos;s on shift.</p>
          </form>
        ) : state.signInAvailable ? (
          signingIn ? (
            <div className="space-y-2">
              <p className="text-[11px] text-text-secondary">We&apos;ll email you a 6-digit code. No password.</p>
              <EmailSignIn compact onDone={() => load()} />
            </div>
          ) : (
            <button type="button" onClick={() => setSigningIn(true)} className="pixel w-full rounded-[8px] bg-[#d9ff3f] px-3 py-3 text-[9px] text-[#0b0d11]">
              SIGN IN TO CHAT
            </button>
          )
        ) : (
          <p className="text-center text-[11px] text-text-muted">Chatting opens soon. You can read along in the meantime.</p>
        )}
      </div>
    </section>
  );
}

function Message({ m, quoted, canReply, onReply }: { m: ChatMessage; quoted?: ChatMessage; canReply: boolean; onReply: () => void }) {
  const pep = m.role === "pep";
  return (
    <div className={`group flex gap-2 ${pep ? "" : ""}`}>
      {pep ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/pep/pep-portrait.webp" alt="" width={28} height={28} className="mt-0.5 h-7 w-7 shrink-0 rounded-[8px] object-cover" />
      ) : (
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-white/8 text-[11px] font-bold text-white/70" style={{ background: avatarBg(m.author) }}>
          {m.author.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className={`min-w-0 flex-1 rounded-[10px] px-2.5 py-1.5 ${pep ? "border border-[#d9ff3f]/40 bg-[#d9ff3f]/[0.06]" : "bg-white/[0.04]"}`}>
        <div className="flex items-baseline gap-1.5">
          <span className={`truncate text-[12px] font-bold ${pep ? "text-[#d9ff3f]" : "text-white"}`}>{pep ? "Pep · AI CEO" : m.author}</span>
          <time dateTime={m.at} className="tabular shrink-0 text-[10px] text-text-muted">
            {timeFmt.format(new Date(m.at))}
          </time>
          {canReply && (
            <button type="button" onClick={onReply} className="ml-auto shrink-0 text-[10px] font-semibold text-text-muted opacity-0 transition-opacity hover:text-white focus:opacity-100 group-hover:opacity-100">
              Reply
            </button>
          )}
        </div>
        {quoted && (
          <p className="mt-0.5 truncate border-l-2 border-white/15 pl-1.5 text-[11px] text-text-muted">
            {quoted.author}: {quoted.body}
          </p>
        )}
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-white/90">{m.body}</p>
      </div>
    </div>
  );
}

/** A stable muted colour per name, so regulars are recognisable. */
function avatarBg(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 35% 24%)`;
}
