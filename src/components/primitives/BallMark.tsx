/**
 * Good Football Company mark: a stylised hexagonal football — a central
 * pointy-top hexagon ringed by six trapezoidal panels (one per edge). Five
 * panels and the centre use `currentColor` so the mark inverts cleanly between
 * the dark (white) and light (dark) themes; the right-hand panel is the lime
 * accent in both. This is the ONLY brand mark in the app.
 */
export function BallMark({ className }: { className?: string }) {
  // Base outer panel, drawn on the right edge; rotated in 60° steps around the
  // centre (50,50) to reach all six edges. Rotation 0 is the lime panel.
  const panel = { x: 72, y: 39, width: 11, height: 22, rx: 5 } as const;

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden role="img" xmlns="http://www.w3.org/2000/svg">
      {/* central hexagon (stroke + round join give soft corners) */}
      <polygon
        points="50,33 64.72,41.5 64.72,58.5 50,67 35.28,58.5 35.28,41.5"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={4.5}
        strokeLinejoin="round"
      />

      {/* five white outer panels */}
      <g fill="currentColor">
        {[60, 120, 180, 240, 300].map((deg) => (
          <rect key={deg} {...panel} transform={`rotate(${deg} 50 50)`} />
        ))}
      </g>

      {/* lime accent panel (right edge) */}
      <rect {...panel} fill="var(--accent-lime)" />
    </svg>
  );
}
