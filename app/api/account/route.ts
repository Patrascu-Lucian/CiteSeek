import { NextResponse } from "next/server";

import { signOut } from "@/auth";
import { getActor } from "@/lib/auth/actor";
import { deleteUserAccount } from "@/lib/users/deletion";

export const runtime = "nodejs";

/**
 * GDPR right to erasure. The session is destroyed *before* the row, or a
 * signed-in cookie points at a user that no longer exists and every later
 * request handles it as a special case. A guest is rejected rather than quietly
 * succeeding: nothing about one is written, so 204 would imply a deletion.
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
