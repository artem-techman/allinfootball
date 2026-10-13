"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Match } from "@/lib/providers/types";
import { CheckIcon, CloseIcon, DownloadIcon, LinkIcon, ShareIcon } from "@/components/primitives/icons";
import {
  cardFileName,
  cardPath,
  resultHeadline,
  shareText,
  shareUrl,
  whatsappUrl,
  xIntentUrl,
  type ShareCardFormat,
} from "@/lib/seo/shareCardData";

/**
 * "Share" on a finished match: a small dialog (bottom sheet on phones, popover
 * on desktop) with a preview of the story card and the places to post it.
 *
 *  - Instagram Story: hands the 1080x1920 card to the OS share sheet where files
 *    can be shared (phones — Instagram, TikTok, WhatsApp… appear there);
 *    elsewhere it downloads the image with a hint to post from the phone.
 *  - X / WhatsApp: prefilled compose links (X renders the page's own OG card).
 *  - Download (story or square) and Copy link.
 *
 * Shared links carry utm_source=share&utm_medium=<channel>. No third-party
 * scripts or pixels: every action is a plain link, download or Web Share call.
 */

/** Matches the CSS transition duration below (ms) for the exit animation. */
const TRANSITION_MS = 200;
const PANEL_WIDTH = 420;
const DESKTOP_QUERY = "(min-width: 640px)";

type Busy = "instagram" | "story" | "square" | null;

export function ShareSheet({ match }: { match: Match }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [canShareLink, setCanShareLink] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => setOpen(false), []);

  const flash = useCallback((message: string, ok = true) => {
    setToast({ message, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // Enter/exit transition, driven off `open` (same pattern as MobileNav).
  useEffect(() => {
    if (open) {
      setDesktop(window.matchMedia(DESKTOP_QUERY).matches);
      setMounted(true);
      const id = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(id);
    }
    setShow(false);
    const id = setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => clearTimeout(id);
  }, [open]);

  // What this browser can share (checked once the user opens the sheet).
  useEffect(() => {
    if (!open) return;
    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
    setCanShareLink(typeof nav.share === "function");
    try {
      const probe = new File([new Blob([""], { type: "image/png" })], "probe.png", { type: "image/png" });
      setCanShareFiles(typeof nav.share === "function" && Boolean(nav.canShare?.({ files: [probe] })));
    } catch {
      setCanShareFiles(false);
    }
  }, [open]);

  // Fetch the story card once the sheet opens: it is the preview AND the file the
  // Instagram option shares, so the share call can run straight from the tap
  // (Safari drops the user gesture if we fetch first).
  useEffect(() => {
    if (!open || preview) return;
    let cancelled = false;
    setPreviewFailed(false);
    fetchCard(match, "story")
      .then((blob) => {
        if (!cancelled) setPreview({ blob, url: URL.createObjectURL(blob) });
      })
      .catch(() => {
        if (!cancelled) setPreviewFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, preview, match]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  // Escape closes; Tab stays inside the dialog; focus returns to the trigger.
  useEffect(() => {
    if (!mounted) return;
    const trigger = triggerRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = focusables(panelRef.current);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // Start on the first share option (not the close button).
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>("ul button, ul a") ?? panel)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [mounted]);

  // Phones: lock the page behind the bottom sheet.
  useEffect(() => {
    if (!mounted || desktop) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted, desktop]);

  // Desktop: anchor the popover to the button (below it, or above when there's
  // more room there), clamped to the viewport.
  useLayoutEffect(() => {
    if (!mounted || !desktop) return;
    const place = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const r = trigger.getBoundingClientRect();
      const h = panel.offsetHeight;
      const left = Math.min(Math.max(16, r.left + r.width / 2 - PANEL_WIDTH / 2), window.innerWidth - PANEL_WIDTH - 16);
      const below = window.innerHeight - r.bottom - 16;
      const above = r.top - 16;
      const top = below >= h + 8 || below >= above ? r.bottom + 8 : Math.max(16, r.top - 8 - h);
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [mounted, desktop, preview, previewFailed]);

  /* ---------------------------------- actions ---------------------------------- */

  async function shareStory() {
    if (busy) return;
    setBusy("instagram");
    try {
      const blob = preview?.blob ?? (await fetchCard(match, "story"));
      const file = new File([blob], cardFileName(match, "story"), { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
        try {
          // The link rides in `text` rather than `url`: with a `url` some share
          // targets (iOS) take only the link and drop the image.
          await nav.share({
            files: [file],
            title: resultHeadline(match),
            text: `${shareText(match)} ${shareUrl(match, "instagram")}`,
          });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return; // user closed the sheet
          download(blob, cardFileName(match, "story"));
          flash("Saved — post it from your phone's Instagram");
        }
      } else {
        download(blob, cardFileName(match, "story"));
        flash("Saved — post it from your phone's Instagram");
      }
    } catch {
      flash("Couldn't make the image — try again", false);
    } finally {
      setBusy(null);
    }
  }

  async function downloadCard(format: ShareCardFormat) {
    if (busy) return;
    setBusy(format);
    try {
      const blob = format === "story" && preview ? preview.blob : await fetchCard(match, format);
      download(blob, cardFileName(match, format));
      flash("Image saved");
    } catch {
      flash("Couldn't download the image — try again", false);
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl(match, "copy"));
      flash("Link copied");
    } catch {
      flash("Couldn't copy — copy the address bar instead", false);
    }
  }

  async function shareLinkNative() {
    try {
      await navigator.share({ title: resultHeadline(match), text: shareText(match), url: shareUrl(match, "native") });
      close();
    } catch {
      /* dismissed */
    }
  }

  /* ----------------------------------- render ----------------------------------- */

  const panelBase =
    "flex flex-col bg-card text-text-primary shadow-elevated outline-none transition-[opacity,transform] duration-200 ease-out-soft motion-reduce:transition-none";
  const panelClass = desktop
    ? `${panelBase} fixed z-[61] max-h-[calc(100vh-32px)] overflow-y-auto rounded-card border border-hairline ${
        show && pos ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
      }`
    : `${panelBase} fixed inset-x-0 bottom-0 z-[61] max-h-[88vh] overflow-y-auto rounded-t-lg2 border-t border-hairline pb-[max(16px,env(safe-area-inset-bottom))] ${
        show ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // Styled exactly like the Back link opposite it: quiet text + icon.
        className="inline-flex items-center gap-1.5 text-meta font-semibold text-text-secondary transition-colors hover:text-text-primary"
      >
        <ShareIcon size={16} />
        Share
      </button>

      {mounted &&
        createPortal(
          <>
            <div
              className={`fixed inset-0 z-[60] transition-opacity duration-200 motion-reduce:transition-none ${
                desktop ? "bg-transparent" : "bg-black/60"
              } ${show ? "opacity-100" : "opacity-0"}`}
              onClick={close}
              aria-hidden
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-sheet-title"
              tabIndex={-1}
              className={panelClass}
              style={desktop ? { width: PANEL_WIDTH, top: pos?.top ?? -9999, left: pos?.left ?? 0 } : undefined}
            >
              {!desktop && <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/20" />}
              <div className="flex items-center justify-between px-4 pb-2 pt-3">
                <h2 id="share-sheet-title" className="text-cardtitle font-semibold">
                  Share result
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="grid h-8 w-8 place-items-center rounded-tile text-text-muted hover:bg-white/5 hover:text-text-primary"
                >
                  <CloseIcon size={18} />
                </button>
              </div>

              <div className="flex gap-4 px-4 pb-4">
                <div className="w-[112px] shrink-0">
                  <div className="relative aspect-[9/16] w-full overflow-hidden rounded-tile border border-hairline bg-surface-dark-2">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview.url}
                        alt={`Share card: ${resultHeadline(match)}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className={`grid h-full place-items-center p-2 text-center text-[11px] text-text-muted ${
                          previewFailed ? "" : "animate-pulse motion-reduce:animate-none"
                        }`}
                      >
                        {previewFailed ? "Preview unavailable" : "Creating image…"}
                      </div>
                    )}
                  </div>
                </div>

                <ul className="flex min-w-0 flex-1 flex-col gap-1">
                  <Option
                    icon={<InstagramGlyph />}
                    label="Instagram Story"
                    hint={canShareFiles ? "Also TikTok, WhatsApp status…" : "Downloads the story image"}
                    onClick={shareStory}
                    busy={busy === "instagram"}
                  />
                  <OptionLink icon={<XGlyph />} label="X" href={xIntentUrl(match)} onNavigate={close} />
                  <OptionLink icon={<WhatsAppGlyph />} label="WhatsApp" href={whatsappUrl(match)} onNavigate={close} />
                  {canShareLink && <Option icon={<ShareIcon size={18} />} label="More apps" onClick={shareLinkNative} />}
                  <Option
                    icon={<DownloadIcon size={18} />}
                    label="Download story"
                    hint="1080 × 1920"
                    onClick={() => downloadCard("story")}
                    busy={busy === "story"}
                  />
                  <Option
                    icon={<DownloadIcon size={18} />}
                    label="Download square"
                    hint="1080 × 1080"
                    onClick={() => downloadCard("square")}
                    busy={busy === "square"}
                  />
                  <Option icon={<LinkIcon size={18} />} label="Copy link" onClick={copyLink} />
                </ul>
              </div>
            </div>
          </>,
          document.body,
        )}

      {toast &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full border border-hairline bg-surface-dark-2 px-4 py-2 text-meta text-text-primary shadow-elevated"
          >
            {toast.ok && <CheckIcon size={15} className="text-accent-lime" />}
            {toast.message}
          </div>,
          document.body,
        )}
    </>
  );
}

/* ---------------------------------- pieces ---------------------------------- */

const OPTION_CLASS =
  "flex w-full items-center gap-3 rounded-tile px-2.5 py-2 text-left text-body font-medium text-text-primary transition-colors hover:bg-white/5 disabled:opacity-60";

function Option({
  icon,
  label,
  hint,
  onClick,
  busy = false,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <li>
      <button type="button" onClick={onClick} disabled={busy} aria-busy={busy} className={OPTION_CLASS}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-tile bg-card-2 text-text-secondary">{icon}</span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{busy ? "Preparing…" : label}</span>
          {hint && <span className="truncate text-[11px] font-normal text-text-muted">{hint}</span>}
        </span>
      </button>
    </li>
  );
}

function OptionLink({ icon, label, href, onNavigate }: { icon: ReactNode; label: string; href: string; onNavigate: () => void }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={OPTION_CLASS}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-tile bg-card-2 text-text-secondary">{icon}</span>
        <span className="truncate">{label}</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </li>
  );
}

function InstagramGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function XGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WhatsAppGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
      <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z" />
      <path
        d="M9 8.5c0 3 2.5 6 5.5 6.5l1.2-1.3-1.8-.9-.8.8c-1-.4-2-1.4-2.4-2.4l.8-.8-.9-1.8z"
        strokeWidth={1.3}
      />
    </svg>
  );
}

/* ---------------------------------- helpers ---------------------------------- */

async function fetchCard(match: Match, format: ShareCardFormat): Promise<Blob> {
  const res = await fetch(cardPath(match, format));
  if (!res.ok) throw new Error(`card ${res.status}`);
  const blob = await res.blob();
  // Some platforms need the exact type on the File for share targets to accept it.
  return blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a); // Safari/Firefox need it in the DOM to fire
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => !el.hasAttribute("aria-hidden"));
}
