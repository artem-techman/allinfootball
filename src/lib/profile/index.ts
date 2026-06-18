"use client";

/**
 * Personalization without auth (CLAUDE.md section 7). The display name,
 * Following, Your Teams, and Favorites are persisted in localStorage behind this
 * module so it can later be swapped for real accounts with no call-site change.
 * All followed entities must be within the nine competitions (enforced by the
 * UI that calls add*).
 */

const STORAGE_KEY = "allinfootball.profile.v1";

export interface Profile {
  name: string;
  followingTeamIds: number[];
  followingPlayerIds: number[];
  favoriteTeamIds: number[];
  /** which team's badge shows the gold "primary" star */
  primaryTeamId: number | null;
}

const DEFAULT_PROFILE: Profile = {
  name: "Alex",
  followingTeamIds: [],
  followingPlayerIds: [],
  favoriteTeamIds: [],
  primaryTeamId: null,
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadProfile(): Profile {
  if (!isBrowser()) return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: Profile): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent("allinfootball:profile-changed"));
  } catch {
    /* quota / private mode — degrade silently */
  }
}

export function setName(name: string): Profile {
  const p = loadProfile();
  const next = { ...p, name: name.trim() || DEFAULT_PROFILE.name };
  saveProfile(next);
  return next;
}

export function toggleFollowTeam(teamId: number): Profile {
  const p = loadProfile();
  const has = p.followingTeamIds.includes(teamId);
  const next: Profile = {
    ...p,
    followingTeamIds: has
      ? p.followingTeamIds.filter((id) => id !== teamId)
      : [...p.followingTeamIds, teamId],
    primaryTeamId:
      has && p.primaryTeamId === teamId ? null : p.primaryTeamId ?? teamId,
  };
  saveProfile(next);
  return next;
}

export function setPrimaryTeam(teamId: number): Profile {
  const p = loadProfile();
  const next = { ...p, primaryTeamId: teamId };
  saveProfile(next);
  return next;
}
