import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { checkIdToken, safeNext } = await import("@/lib/auth/google");

const token = (claims: Record<string, unknown>) =>
  `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const now = Date.parse("2026-11-03T12:00:00Z");
const good = {
  iss: "https://accounts.google.com",
  aud: "client-1",
  exp: now / 1000 + 300,
  sub: "1234",
  email: "Fan@Example.com",
  email_verified: true,
  name: "A Fan",
  picture: "https://lh3.googleusercontent.com/a/x",
};

describe("checkIdToken", () => {
  it("accepts a valid token and lowercases the email", () => {
    expect(checkIdToken(token(good), "client-1", now)).toEqual({
      sub: "1234",
      email: "fan@example.com",
      name: "A Fan",
      picture: "https://lh3.googleusercontent.com/a/x",
    });
  });
  it("rejects another app's token, an expired one, a wrong issuer and an unverified email", () => {
    expect(checkIdToken(token(good), "client-2", now)).toBeNull();
    expect(checkIdToken(token({ ...good, exp: now / 1000 - 1 }), "client-1", now)).toBeNull();
    expect(checkIdToken(token({ ...good, iss: "https://evil.example" }), "client-1", now)).toBeNull();
    expect(checkIdToken(token({ ...good, email_verified: false }), "client-1", now)).toBeNull();
    expect(checkIdToken("garbage", "client-1", now)).toBeNull();
  });
});

describe("safeNext", () => {
  it("only returns to paths on our own site", () => {
    expect(safeNext("/pep")).toBe("/pep");
    expect(safeNext("//evil.example")).toBe("/my-club");
    expect(safeNext("/\\evil.example")).toBe("/my-club");
    expect(safeNext("https://evil.example")).toBe("/my-club");
    expect(safeNext(null)).toBe("/my-club");
  });
});
