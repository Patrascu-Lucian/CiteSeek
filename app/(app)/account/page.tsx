import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getActor } from "@/lib/auth/actor";
import { listSignInMethods, providerLabel } from "@/lib/users/queries";

import { AccountView } from "./account-view";

export const metadata: Metadata = { title: "Account" };

/**
 * Resolves who is asking, and hands the markup what to show them.
 *
 * Three lines of logic for the same reason `(marketing)/page.tsx` is: asking for
 * the actor makes this async and reaches into Auth.js, neither of which React
 * Testing Library can render. Everything visual is in `AccountView`.
 *
 * The redirect is a backstop. `proxy.ts` matches `/account` and turns a
 * credential-less request into a sign-in redirect before this renders — but a
 * page that assumes its guard ran is a page that breaks silently the next time
 * the matcher changes.
 */
export default async function AccountPage() {
  const actor = await getActor();

  if (!actor) redirect("/sign-in?callbackUrl=/account");

  if (actor.type === "guest") return <AccountView kind="guest" />;

  const methods = await listSignInMethods(actor.id);

  return (
    <AccountView
      kind="user"
      name={actor.name}
      email={actor.email}
      providers={methods.map((method) => providerLabel(method.provider))}
    />
  );
}
