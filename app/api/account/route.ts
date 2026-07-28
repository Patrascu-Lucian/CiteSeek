import { NextResponse } from "next/server";

import { signOut } from "@/auth";
import { getActor } from "@/lib/auth/actor";
import { deleteUserAccount } from "@/lib/users/deletion";

export const runtime = "nodejs";

/**
 * GDPR right to erasure.
 *
 * Deletes the account and everything reachable from it: accounts, sessions,
 * workspaces, documents, chunks and their embeddings, chats and messages. One
 * statement, because the schema's cascade chain was built to make it one.
 *
 * The session is destroyed *before* the row is deleted. Doing it the other way
 * round leaves a signed-in cookie pointing at a user that no longer exists,
 * which every subsequent request then has to handle as a special case.
 *
 * Guests are rejected rather than silently succeeding: nothing about a guest is
 * ever written to the database, so there is nothing to erase, and returning 204
 * would imply a deletion that never happened.
 */
export async function DELETE() {
  const actor = await getActor();

  if (!actor) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (actor.type === "guest") {
    return NextResponse.json(
      {
        error:
          "Guest sessions store nothing on the server, so there is no account to delete. Close the tab or clear cookies to end the session.",
      },
      { status: 400 },
    );
  }

  await signOut({ redirect: false });
  const deleted = await deleteUserAccount(actor.id);

  if (!deleted) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
