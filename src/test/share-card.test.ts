import { describe, it, expect } from "vitest";
import {
  cardFileName,
  cardPath,
  formatMinute,
  resultStatusLine,
  scorerSides,
  shareText,
  shareUrl,
  teamInitials,
  whatsappUrl,
  xIntentUrl,
} from "@/lib/seo/shareCardData";
import type { Match, MatchEvent } from "@/lib/providers/types";

const HOME = 9;
const AWAY = 768;

const match = {
  id: 1234,
  slug: "spain-italy-1234",
  competitionId: 5,
  seasonYear: 2026,
  kickoffUtc: "2026-10-11T18:45:00Z",
  status: "finished",
  resultType: "ft",
  homeTeamId: HOME,
  awayTeamId: AWAY,
  homeScore: 2,
  awayScore: 1,
  homeTeam: { id: HOME, slug: "spain-9", name: "Spain", crest: "" },
  awayTeam: { id: AWAY, slug: "italy-768", name: "Italy", crest: "" },
  competition: { id: 5, slug: "nations-league", name: "UEFA Nations League", logo: "" },
} as unknown as Match;

let seq = 0;
function ev(
  minute: number,
  type: MatchEvent["type"],
  teamId: number,
  playerName: string,
  opts: { extra?: number; playerId?: number } = {},
): MatchEvent {
  return {
    id: String(seq++),
    matchId: 1234,
    minute,
    extraMinute: opts.extra,
    type,
    teamId,
    playerName,
    playerId: opts.playerId,
  };
}

describe("formatMinute", () => {
  it("formats normal and stoppage-time minutes", () => {
    expect(formatMinute({ minute: 23 })).toBe("23'");
    expect(formatMinute({ minute: 90, extraMinute: 2 })).toBe("90+2'");
    expect(formatMinute({ minute: 45, extraMinute: 0 })).toBe("45'");
  });
});

describe("scorerSides", () => {
  it("groups a player's goals and orders them by minute, with penalty markers", () => {
    const sides = scorerSides(match, [
      ev(67, "penalty", HOME, "E. Haaland", { playerId: 1100 }),
      ev(23, "goal", HOME, "E. Haaland", { playerId: 1100 }),
      ev(40, "goal", AWAY, "F. Chiesa", { playerId: 7 }),
    ]);
    expect(sides.home).toEqual([{ name: "E. Haaland", minutes: "23', 67' (P)" }]);
    expect(sides.away).toEqual([{ name: "F. Chiesa", minutes: "40'" }]);
    expect(sides.homeMore).toBe(0);
  });

  it("orders scorers by their first goal, stoppage time after the base minute", () => {
    const sides = scorerSides({ ...match, homeScore: 3 }, [
      ev(91, "goal", HOME, "C. Late"),
      ev(90, "goal", HOME, "B. Stoppage", { extra: 2 }),
      ev(90, "goal", HOME, "A. Ninety"),
    ]);
    expect(sides.home.map((l) => `${l.name} ${l.minutes}`)).toEqual([
      "A. Ninety 90'",
      "B. Stoppage 90+2'",
      "C. Late 91'",
    ]);
  });

  it("credits own goals to the benefiting side with an (OG) marker", () => {
    const sides = scorerSides(match, [
      ev(12, "own_goal", AWAY, "G. Di Lorenzo"), // Italy player's OG → Spain's goal
      ev(30, "goal", HOME, "Á. Morata"),
      ev(55, "own_goal", HOME, "A. Laporte"), // Spain player's OG → Italy's goal
    ]);
    expect(sides.home).toEqual([
      { name: "G. Di Lorenzo", minutes: "12' (OG)" },
      { name: "Á. Morata", minutes: "30'" },
    ]);
    expect(sides.away).toEqual([{ name: "A. Laporte", minutes: "55' (OG)" }]);
  });

  it("ignores non-goal events (missed penalties, cards, subs, VAR)", () => {
    const sides = scorerSides(match, [
      ev(10, "missed_penalty", HOME, "Rodri"),
      ev(20, "yellow", AWAY, "Jorginho"),
      ev(60, "sub", HOME, "Pedri"),
      ev(70, "var", AWAY, "Chiesa"),
    ]);
    expect(sides.home).toEqual([]);
    expect(sides.away).toEqual([]);
  });

  it("caps each side and reports the overflow", () => {
    const events = ["A", "B", "C", "D", "E", "F", "G", "H"].map((n, i) => ev(i * 10 + 1, "goal", HOME, n));
    const sides = scorerSides({ ...match, homeScore: 8 }, events, 6);
    expect(sides.home).toHaveLength(6);
    expect(sides.home[5].name).toBe("F");
    expect(sides.homeMore).toBe(2);
    expect(sides.awayMore).toBe(0);
  });

  it("drops shootout kicks (filed as 120' penalties) after a penalty shootout", () => {
    const pens = { ...match, homeScore: 1, awayScore: 1, homePenalty: 4, awayPenalty: 3, resultType: "pen" as const };
    const sides = scorerSides(pens, [
      ev(50, "goal", HOME, "Á. Morata"),
      ev(88, "goal", AWAY, "F. Chiesa"),
      ev(120, "penalty", HOME, "Rodri"),
      ev(120, "penalty", AWAY, "Jorginho"),
      ev(120, "penalty", HOME, "Pedri"),
    ]);
    expect(sides.home).toEqual([{ name: "Á. Morata", minutes: "50'" }]);
    expect(sides.away).toEqual([{ name: "F. Chiesa", minutes: "88'" }]);
  });

  it("keeps a missing player name readable", () => {
    const sides = scorerSides(match, [{ ...ev(5, "goal", HOME, ""), playerName: undefined }]);
    expect(sides.home).toEqual([{ name: "Goal", minutes: "5'" }]);
  });
});

describe("resultStatusLine", () => {
  it("covers full time, extra time and penalties", () => {
    expect(resultStatusLine({ resultType: "ft" })).toBe("FULL TIME");
    expect(resultStatusLine({})).toBe("FULL TIME");
    expect(resultStatusLine({ resultType: "aet" })).toBe("AFTER EXTRA TIME");
    expect(resultStatusLine({ resultType: "pen", homePenalty: 4, awayPenalty: 3 })).toBe("AFTER PENALTIES (4–3)");
    expect(resultStatusLine({ resultType: "pen" })).toBe("AFTER PENALTIES");
  });
});

describe("share copy and links", () => {
  it("builds the post text without inventing a handle", () => {
    expect(shareText(match)).toBe("Spain 2–1 Italy · UEFA Nations League ⚽ via myfootballtracker.com");
    expect(shareText({ ...match, homeScore: 1, awayScore: 1, homePenalty: 4, awayPenalty: 3 })).toBe(
      "Spain 1–1 Italy (4–3 pens) · UEFA Nations League ⚽ via myfootballtracker.com",
    );
  });

  it("tags shared links with utm_source=share and the channel", () => {
    expect(shareUrl(match, "whatsapp")).toBe(
      "https://myfootballtracker.com/match/spain-italy-1234?utm_source=share&utm_medium=whatsapp",
    );
    const x = new URL(xIntentUrl(match));
    expect(x.origin + x.pathname).toBe("https://x.com/intent/post");
    expect(x.searchParams.get("url")).toBe(
      "https://myfootballtracker.com/match/spain-italy-1234?utm_source=share&utm_medium=x",
    );
    expect(x.searchParams.get("text")).toBe(shareText(match));
    const wa = new URL(whatsappUrl(match));
    expect(wa.searchParams.get("text")).toContain("utm_medium=whatsapp");
  });

  it("points at the card routes and names downloads", () => {
    expect(cardPath(match, "story")).toBe("/match/spain-italy-1234/card/story");
    expect(cardPath(match, "square")).toBe("/match/spain-italy-1234/card/square");
    expect(cardFileName(match, "story")).toBe("spain-italy-2-1-story.png");
  });

  it("derives crest-fallback initials", () => {
    expect(teamInitials("Real Madrid")).toBe("RM");
    expect(teamInitials("Arsenal")).toBe("AR");
    expect(teamInitials("FC Barcelona")).toBe("BA");
    expect(teamInitials("Borussia Mönchengladbach")).toBe("BM");
  });
});

describe("crest format sniffing (GIF served as image/png)", async () => {
  const { imageKind } = await import("@/lib/seo/ogImage");
  it("recognises formats by their bytes", () => {
    expect(imageKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(imageKind(Buffer.from("GIF87a\x01\x00", "binary"))).toBe("gif");
    expect(imageKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(imageKind(Buffer.from("hello"))).toBe("unknown");
  });
});

describe("share text follows the match state", () => {
  it("live, half-time and upcoming", async () => {
    const { shareText, telegramShareUrl } = await import("@/lib/seo/shareCardData");
    const base = {
      id: 7, slug: "juventus-celta-vigo-7", competitionId: 3, seasonYear: 2026, kickoffUtc: "2026-10-15T19:00:00Z",
      homeTeamId: 496, awayTeamId: 538, homeTeam: { id: 496, slug: "j", name: "Juventus" }, awayTeam: { id: 538, slug: "c", name: "Celta Vigo" },
      competition: { id: 3, slug: "europa-league", name: "UEFA Europa League" },
    } as const;
    expect(shareText({ ...base, status: "live", minute: 63, homeScore: 1, awayScore: 0 })).toBe(
      "🔴 LIVE: Juventus 1–0 Celta Vigo (63') · UEFA Europa League ⚽ follow it on myfootballtracker.com",
    );
    expect(shareText({ ...base, status: "live", minute: 90, extraMinute: 3, homeScore: 0, awayScore: 0 })).toContain("(90+3')");
    expect(shareText({ ...base, status: "ht", homeScore: 0, awayScore: 0 })).toContain("Juventus 0–0 Celta Vigo (HT)");
    expect(shareText({ ...base, status: "scheduled" })).toBe("Juventus vs Celta Vigo · Thu 15 Oct, 20:00 UK · UEFA Europa League ⚽ via myfootballtracker.com");
    const tg = new URL(telegramShareUrl({ ...base, status: "scheduled" }));
    expect(tg.searchParams.get("url")).toContain("utm_medium=telegram");
  });
});
