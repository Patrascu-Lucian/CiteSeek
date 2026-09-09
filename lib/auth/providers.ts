import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

/** One list: `auth.ts` configures these and two pages render a button each, so
 * a second literal is a button whose callback does not exist. Array order is
 * rendering order. `id` is the provider's own — `signIn(id)` and the
 * `AUTH_<ID>_SECRET` lookup both key on it. */
export const AUTH_PROVIDERS = [
  { id: "google", label: "Google", provider: Google },
  { id: "github", label: "GitHub", provider: GitHub },
] as const;
