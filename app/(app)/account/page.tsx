import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getActor } from "@/lib/auth/actor";
import { listSignInMethods, providerLabel } from "@/lib/users/queries";

import { AccountView } from "./account-view";

export const metadata: Metadata = { title: "Account" };

/**
 * Everything visual is in `AccountView`: asking for the actor makes this async
 * and reaches into Auth.js, neither of which React Testing Library can render.
 * The redirect is a backstop — `proxy.ts` already catches this, but a page
 * assuming its guard ran breaks silently the next time the matcher changes.
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
