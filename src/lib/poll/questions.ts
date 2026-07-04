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
    text: "How old are you?",
    options: [
      { id: "u18", label: "Under 18" },
      { id: "a18_24", label: "18–24" },
      { id: "a25_34", label: "25–34" },
      { id: "a35_44", label: "35–44" },
      { id: "a45", label: "45+" },
    ],
  },
  {
    id: "bet_freq",
    text: "Do you ever bet on football?",
    options: [
      { id: "weekly", label: "Most weeks" },
      { id: "sometimes", label: "Now and then" },
      { id: "tried", label: "Tried it once or twice" },
      { id: "never", label: "Never" },
    ],
  },
  {
    id: "fantasy",
    text: "Fantasy football or score predictors?",
    options: [
      { id: "active", label: "Yes — every week" },
      { id: "casual", label: "Casually" },
      { id: "no", label: "Not my thing" },
    ],
  },
  {
    id: "watch_week",
    text: "Matches you watch in a normal week?",
    options: [
      { id: "w01", label: "0–1" },
      { id: "w24", label: "2–4" },
      { id: "w59", label: "5–9" },
      { id: "w10", label: "10+" },
    ],
  },
  {
    id: "check_freq",
    text: "How often do you check scores?",
    options: [
      { id: "many_daily", label: "Several times a day" },
      { id: "daily", label: "About once a day" },
      { id: "matchdays", label: "Matchdays only" },
      { id: "rarely", label: "Now and then" },
    ],
  },
  {
    id: "watch_where",
    text: "Where do you mostly watch matches?",
    options: [
      { id: "tv", label: "TV / cable" },
      { id: "paid_stream", label: "Paid streaming" },
      { id: "free_stream", label: "Free streams" },
      { id: "highlights", label: "Highlights only" },
    ],
  },
  {
    id: "spend",
    text: "Spent on football this season? (tickets, merch, subs)",
    options: [
      { id: "none", label: "Nothing" },
      { id: "low", label: "Under €50" },
      { id: "mid", label: "€50–200" },
      { id: "high", label: "€200+" },
    ],
  },
];

/** Quick lookup used by the API route to validate votes. */
export function isValidVote(questionId: string, optionId: string): boolean {
  const q = POLL_QUESTIONS.find((x) => x.id === questionId);
  return Boolean(q && q.options.some((o) => o.id === optionId));
}
