/** Lower-case name particles that belong with the surname ("van Dijk", "De Bruyne", "El Shaarawy"). */
const PARTICLES = new Set([
  "al", "ben", "bin", "da", "das", "de", "del", "della", "der", "den", "di", "do", "dos", "du",
  "el", "la", "le", "ten", "ter", "van", "von",
]);
const SUFFIXES = /^(jr\.?|junior|sr\.?|ii|iii|iv)$/i;

/**
 * The label under a player on the formation pitch (B33): surname only, so it
 * fits without truncation. Keeps particles with the surname ("Virgil van Dijk"
 * → "van Dijk", "Kevin De Bruyne" → "De Bruyne") and a trailing "Jr."
 * ("Vinícius Jr." stays whole). A capitalised FIRST word is treated as a first
 * name, not a particle ("Ben White" → "White"); "M. Mittelstädt" → "Mittelstädt".
 */
export function pitchName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  let start = parts.length - 1;
  if (SUFFIXES.test(parts[start])) start -= 1;
  while (start > 0 && PARTICLES.has(parts[start - 1].toLowerCase())) {
    const word = parts[start - 1];
    // Index 0 only counts as a particle when written lower-case ("de Jong").
    if (start - 1 === 0 && word[0] !== word[0].toLowerCase()) break;
    start -= 1;
  }
  return parts.slice(start).join(" ");
}
