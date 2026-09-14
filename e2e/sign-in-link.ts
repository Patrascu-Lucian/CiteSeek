import { createHash } from "node:crypto";

// Auth.js stores `SHA-256(rawToken + AUTH_SECRET)`, never the token it emailed,
// so a link can be minted here and no mail need be sent.
//
// Thrown rather than defaulted: with the wrong secret every negative test in
// `magic-link.spec.ts` passes for the wrong reason, and only the positive one
// notices. `@auth/core` keeps `secret` as an array, so `AUTH_SECRET_1..3`
// rotation would need the first entry here rather than a join.
const secret = () => {
  const value = process.env.AUTH_SECRET;
  if (!value)
    throw new Error("AUTH_SECRET must be set to mint a sign-in link.");
  return value;
};

export const stored = (raw: string) =>
  createHash("sha256").update(`${raw}${secret()}`).digest("hex");

export const callback = (raw: string, email: string) =>
  `/api/auth/callback/scaleway?token=${raw}&email=${encodeURIComponent(email)}`;
