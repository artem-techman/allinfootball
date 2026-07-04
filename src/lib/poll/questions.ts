/**
 * Fan Pulse — the sidebar micro-poll question set.
 *
 * Shared by the widget (renders them) and /api/poll (validates incoming votes
 * against them). Answers are ANONYMOUS: a random client-generated session id,
 * no names/emails/accounts — disclosed in the privacy policy.
 *
 * The set is designed to build an advertiser-grade audience profile (media-kit
 * numbers: adult share, visit frequency, betting/fantasy propensity, viewing
 * habits, spend) while staying fun to answer — one tap each.
 */

export interface PollOption {
  id: string;
  label: string;
}

export interface PollQuestion {
  id: string;
  text: string;
  options: PollOption[];
}

export const POLL_QUESTIONS: PollQuestion[] = [
  {
    id: "age",
    text: "Kick-off! Which age squad are you in?",
    options: [
      { id: "u18", label: "Academy (under 18)" },
      { id: "a18_24", label: "18–24" },
      { id: "a25_34", label: "25–34" },
      { id: "a35_44", label: "35–44" },
      { id: "a45", label: "45+ · seen it all" },
    ],
  },
  {
    id: "bet_freq",
    text: "Be honest — does matchday come with a betslip?",
    options: [
      { id: "weekly", label: "Every matchday, always" },
      { id: "sometimes", label: "When I fancy an upset" },
      { id: "tried", label: "Tried it, not my game" },
      { id: "never", label: "Never touch it" },
    ],
  },
  {
    id: "fantasy",
    text: "Fantasy football: serious business?",
    options: [
      { id: "active", label: "I check it more than my bank" },
      { id: "casual", label: "Set my team, forget it" },
      { id: "no", label: "Fantasy-free life" },
    ],
  },
  {
    id: "watch_week",
    text: "Full matches in a normal week?",
    options: [
      { id: "w01", label: "One if I'm lucky" },
      { id: "w24", label: "2–4 — the good stuff" },
      { id: "w59", label: "5–9 — most nights" },
      { id: "w10", label: "10+ — it's a lifestyle" },
    ],
  },
  {
    id: "check_freq",
    text: "How often do you sneak a score check?",
    options: [
      { id: "many_daily", label: "Constantly. Even at dinner" },
      { id: "daily", label: "Once a day-ish" },
      { id: "matchdays", label: "Matchdays only" },
      { id: "rarely", label: "Only when it's big" },
    ],
  },
  {
    id: "watch_where",
    text: "Your matchday setup?",
    options: [
      { id: "tv", label: "Big TV, cable or satellite" },
      { id: "paid_stream", label: "Paid streaming" },
      { id: "free_stream", label: "The… free routes" },
      { id: "highlights", label: "Highlights next morning" },
    ],
  },
  {
    id: "spend",
    text: "Damage to the wallet this season? (tickets, merch, subs)",
    options: [
      { id: "none", label: "€0 — free-transfer fan" },
      { id: "low", label: "Under €50" },
      { id: "mid", label: "€50–200" },
      { id: "high", label: "€200+ … worth it" },
    ],
  },
];

/** Quick lookup used by the API route to validate votes. */
export function isValidVote(questionId: string, optionId: string): boolean {
  const q = POLL_QUESTIONS.find((x) => x.id === questionId);
  return Boolean(q && q.options.some((o) => o.id === optionId));
}
