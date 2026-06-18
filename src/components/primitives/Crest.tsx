import Image from "next/image";

/**
 * Team/competition crest. Crests come from the data API's logo URLs (legally
 * clean — CLAUDE.md section 11). Falls back to a neutral monogram tile when no
 * logo is present, so a missing crest never breaks layout. Always has alt text.
 */
export function Crest({
  src,
  name,
  size = 24,
}: {
  src?: string;
  name: string;
  size?: number;
}) {
  if (!src) {
    const initials = name.slice(0, 2).toUpperCase();
    return (
      <span
        aria-label={name}
        role="img"
        style={{ width: size, height: size }}
        className="grid shrink-0 place-items-center rounded-full bg-hairline text-[10px] font-semibold text-text-secondary"
      >
        {initials}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt={`${name} crest`}
      width={size}
      height={size}
      className="shrink-0 object-contain"
    />
  );
}
