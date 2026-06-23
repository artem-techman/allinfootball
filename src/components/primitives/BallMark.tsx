/**
 * My Football Tracker mark (brand guide 2026-06-23): a green location pin holding
 * a football pitch's centre circle — an outer ring, the halfway line through it,
 * and the centre spot. The pin uses the brand green (the --accent-lime token,
 * which is green) with white pitch markings, so it reads on both themes. This is
 * the ONLY brand mark in the app.
 */
export function BallMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden role="img" xmlns="http://www.w3.org/2000/svg">
      {/* location pin (teardrop) */}
      <path
        d="M50 7C29.7 7 13 23.7 13 44C13 67 41 84 50 95C59 84 87 67 87 44C87 23.7 70.3 7 50 7Z"
        fill="var(--accent-lime)"
      />
      {/* centre circle + halfway line + centre spot (white pitch markings) */}
      <g fill="none" stroke="#fff" strokeWidth={5}>
        <circle cx="50" cy="43" r="23" />
        <line x1="50" y1="20" x2="50" y2="66" strokeLinecap="round" />
      </g>
      {/* centre spot: white ring with the pin green showing through */}
      <circle cx="50" cy="43" r="7.5" fill="var(--accent-lime)" stroke="#fff" strokeWidth={4.5} />
    </svg>
  );
}
