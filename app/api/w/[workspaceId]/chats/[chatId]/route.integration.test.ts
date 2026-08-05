import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Actor } from "@/lib/auth/actor";
import { getOrCreateChat, listChats } from "@/lib/chats/queries";
import {
  cleanupTestRows,
  createTestClient,
  createTestUser,
  createTestWorkspace,
} from "@/lib/db/test-helpers";

/**
 * Renaming and deleting one conversation, against a real database.
 *
 * The interesting cases are all about *whose* conversation it is. Authorization
 * here is two separate checks — workspace access, then chat ownership in SQL —
 * and the tests below exist because those two are easy to conflate.
 */
const currentActor = vi.hoisted(() => ({ value: null as Actor | null }));
vi.mock("@/lib/auth/actor", () => ({
  getActor: () => Promise.resolve(currentActor.value),
}));

function asUser(id: string): Actor {
  return { type: "user", id, name: null, email: null, image: null };
}

const { client, db } = createTestClient();

beforeAll(() => cleanupTestRows(db));
afterAll(async () => {
  await cleanupTestRows(db);
  await client.end();
});

async function patch(workspaceId: string, chatId: string, title: unknown) {
  const { PATCH } = await import("./route");
  return PATCH(
    new Request("http://test/api/chats", {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
    { params: Promise.resolve({ workspaceId, chatId }) },
  );
}

async function remove(workspaceId: string, chatId: string) {
  const { DELETE } = await import("./route");
  return DELETE(new Request("http://test/api/chats", { method: "DELETE" }), {
    params: Promise.resolve({ workspaceId, chatId }),
  });
}

async function scenario(label: string) {
  const user = await createTestUser(db, label);
  const workspace = await createTestWorkspace(db, {
    ownerId: user.id,
    label: `${label}-ws`,
  });
  const chat = await getOrCreateChat(workspace.id, user.id);
  currentActor.value = asUser(user.id);

  return { user, workspace, chat };
}

describe("PATCH /api/w/[workspaceId]/chats/[chatId]", () => {
  it("renames the caller's own conversation", async () => {
    const { workspace, chat, user } = await scenario("api-rename");

    const response = await patch(workspace.id, chat.id, "Travel expenses");

    expect(response.status).toBe(204);
    const [summary] = await listChats(workspace.id, user.id);
    expect(summary!.title).toBe("Travel expenses");
  });

  it("rejects a body without a title", async () => {
    const { workspace, chat } = await scenario("api-rename-bad");

    expect((await patch(workspace.id, chat.id, 42)).status).toBe(400);
  });

  it("answers 404 for someone else's conversation", async () => {
    // Not 403. A 403 would confirm the conversation exists and belongs to
    // somebody — the same reason workspace access answers not-found.
    const { workspace, chat } = await scenario("api-rename-theirs");
    const stranger = await createTestUser(db, "api-stranger");
    currentActor.value = asUser(stranger.id);

    expect((await patch(workspace.id, chat.id, "Mine now")).status).toBe(404);
  });

  it("refuses a guest, and does not change the conversation", async () => {
    const { workspace, chat, user } = await scenario("api-rename-guest");
    currentActor.value = { type: "guest", id: "guest-1" };

    const response = await patch(workspace.id, chat.id, "Nope");

    /*
      404, not the route's own 403. Workspace access is checked first, and a
      guest has no access to a private workspace at all — so they are refused
      before the "guests have no stored conversations" branch is reached.

      That branch is still live: a guest *can* read the demo workspace, so a
      PATCH aimed at a chat id there passes the workspace check and lands on the
      403. It is not exercised here because the demo is constrained to one row
      by a partial unique index, so a test cannot create a second one to work in.
    */
    expect(response.status).toBe(404);

    currentActor.value = asUser(user.id);
    const [summary] = await listChats(workspace.id, user.id);
    expect(summary!.title).toBeNull();
  });
});

describe("DELETE /api/w/[workspaceId]/chats/[chatId]", () => {
  it("deletes the caller's own conversation", async () => {
    const { workspace, chat, user } = await scenario("api-delete");

    expect((await remove(workspace.id, chat.id)).status).toBe(204);
    expect(await listChats(workspace.id, user.id)).toEqual([]);
  });

  it("answers 404 for someone else's conversation, and leaves it alone", async () => {
    const { workspace, chat, user } = await scenario("api-delete-theirs");
    const stranger = await createTestUser(db, "api-delete-stranger");
    currentActor.value = asUser(stranger.id);

    expect((await remove(workspace.id, chat.id)).status).toBe(404);

    currentActor.value = asUser(user.id);
    expect(await listChats(workspace.id, user.id)).toHaveLength(1);
  });

  it("answers 404 for a conversation that does not exist", async () => {
    const { workspace } = await scenario("api-delete-missing");

    const response = await remove(
      workspace.id,
      "00000000-0000-4000-8000-00000000dead",
    );

    expect(response.status).toBe(404);
  });
});
