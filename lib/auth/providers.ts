import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

/** One list, because the sign-in page renders a button per provider and
 * `auth.ts` configures them: two literals drift into a button whose callback
 * does not exist. `id` is the provider's own id — `signIn(id)` and the
 * `AUTH_<ID>_SECRET` lookup both key on it. */
export const AUTH_PROVIDERS = [
  { id: "github", label: "GitHub", provider: GitHub },
  { id: "google", label: "Google", provider: Google },
] as const;
