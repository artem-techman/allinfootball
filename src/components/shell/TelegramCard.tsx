import Image from "next/image";

export const TELEGRAM_URL = "https://t.me/myfootballtracker";

/** Paper-plane mark (generic, not Telegram's trademarked logo). */
export function PlaneIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M21.7 3.3a1 1 0 0 0-1.05-.23L2.9 9.86a1 1 0 0 0 .02 1.88l4.6 1.62 1.73 5.45a1 1 0 0 0 1.68.38l2.53-2.6 4.43 3.27a1 1 0 0 0 1.57-.6l2.97-14.3a1 1 0 0 0-.73-1.63ZM10.3 14.2l-.62 2.86-1.1-3.47 9.15-6.63-7.43 7.24Z" />
    </svg>
  );
}

/**
 * Invitation to the My Football Tracker Telegram channel (the bot posts live
 * goals, results, highlights and the big stories). Sidebar on desktop, burger
 * menu on phones; a plane icon link when the sidebar is collapsed.
 */
export function TelegramCard({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Join our Telegram channel"
        aria-label="Join our Telegram channel"
        className="mx-auto grid h-10 w-10 place-items-center rounded-tile bg-accent-gradient text-text-on-accent transition-opacity hover:opacity-90"
      >
        <PlaneIcon size={18} />
      </a>
    );
  }
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-card border border-hairline bg-card transition-colors hover:border-accent-lime"
    >
      <div className="relative aspect-[16/8] w-full overflow-hidden">
        <Image
          src="/brand/telegram-banner.webp"
          alt=""
          fill
          sizes="(max-width: 820px) 320px, 220px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-lime backdrop-blur-sm">
          Telegram
        </span>
      </div>
      <div className="px-3.5 pb-3.5 pt-1">
        <p className="text-meta font-bold text-text-primary">Live goals in your pocket</p>
        <p className="mt-0.5 text-[12px] leading-snug text-text-secondary">Goals, results, highlights and the big stories, the moment they happen.</p>
        <span className="mt-3 flex items-center justify-center gap-2 rounded-tile bg-accent-gradient py-2 text-[13px] font-bold text-text-on-accent">
          <PlaneIcon size={15} />
          Join the channel
        </span>
      </div>
    </a>
  );
}
