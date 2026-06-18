"use client";

import { useEffect, useState } from "react";
import { greetingFor } from "@/lib/utils/date";
import { loadProfile, setName } from "@/lib/profile";
import { SearchAutocomplete } from "./SearchAutocomplete";
import { BellIcon, ChevronDownIcon } from "@/components/primitives/icons";
import { STOCK_IMAGES } from "@/lib/preview/homePreview";

/**
 * Greeting header (dark reference): time-of-day "Good evening, {name}! 👋" + a
 * subtitle on the left, a centered full-pill search, and a notification bell (with
 * lime dot) + avatar with chevron on the right. The name is editable via an inline
 * popover, persisted to the localStorage profile (section 7).
 */
export function GreetingHeader() {
  const [name, setNameState] = useState("Alex");
  const [greeting, setGreeting] = useState("Good evening");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const p = loadProfile();
    setNameState(p.name);
    setGreeting(greetingFor());
    function onChange() {
      setNameState(loadProfile().name);
    }
    window.addEventListener("allinfootball:profile-changed", onChange);
    return () => window.removeEventListener("allinfootball:profile-changed", onChange);
  }, []);

  function saveName() {
    setName(draft);
    setEditing(false);
  }

  return (
    <header className="mb-6 flex flex-wrap items-center gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-greeting text-text-primary">
          {greeting}, {name}! <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-meta text-text-secondary">
          Here&apos;s what&apos;s happening in the world of football.
        </p>
      </div>

      <div className="flex flex-1 justify-center">
        <SearchAutocomplete />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-10 w-10 place-items-center rounded-full border border-hairline bg-card text-text-secondary transition-colors hover:text-text-primary"
        >
          <BellIcon size={18} />
          <span
            aria-hidden
            className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent-lime ring-2 ring-card"
          />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setDraft(name === "Alex" ? "" : name);
              setEditing((v) => !v);
            }}
            aria-label="Edit your name"
            className="flex items-center gap-1.5 rounded-full border border-hairline bg-card py-1 pl-1 pr-2"
          >
            <span
              className="h-8 w-8 rounded-full bg-card-2 bg-cover bg-center"
              style={{ backgroundImage: `url(${STOCK_IMAGES.avatar})` }}
            />
            <span className="text-text-secondary">
              <ChevronDownIcon size={16} />
            </span>
          </button>

          {editing && (
            <div className="absolute right-0 z-30 mt-2 w-56 rounded-tile border border-hairline bg-card p-3 shadow-elevated">
              <label className="text-meta text-text-secondary" htmlFor="name-input">
                Your name
              </label>
              <input
                id="name-input"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                placeholder="e.g. Alex"
                className="mt-1 w-full rounded-tile border border-hairline bg-card-2 px-2 py-1.5 text-body text-text-primary outline-none focus:border-white/20"
              />
              <button
                type="button"
                onClick={saveName}
                className="mt-2 w-full rounded-tile bg-accent-lime py-1.5 text-meta font-semibold text-text-on-accent"
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
