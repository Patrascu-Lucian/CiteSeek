import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Actor } from "@/lib/auth/actor";
import {
  appendMessages,
  getOrCreateChat,
  listChatMessages,
  listChats,
  resolveChatForTurn,
} from "@/lib/chats/queries";
import {
  cleanupTestRows,
  createTestClient,
  createTestUser,
  createTestWorkspace,
  findOrCreateDemoWorkspace,
} from "@/lib/db/test-helpers";
import { CAP_PARAM } from "@/lib/limits/caps";
import { DEFAULT_PLAN_LIMITS } from "@/lib/limits/config";

import { createConversation, deleteConversationTurn } from "./actions";

/**
 * Starting a conversation. These exist because the first version was a `GET`,
 * and a prefetch executes the handler — so rendering the page created one.
 */
const currentActor = vi.hoisted(() => ({ value: null as Actor | null }));
vi.mock("@/lib/auth/actor", () => ({
  getActor: () => Promise.resolve(currentActor.value),
}));

/** `revalidatePath` needs a request scope and calling the action directly has
 * none. What it invalidates is covered by `e2e/workspace-shell.spec.ts`. */
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { client, db } = createTestClient();

beforeAll(() => cleanupTestRows(db));
afterAll(async () => {
  await cleanupTestRows(db);
  await client.end();
});

async function scenario(label: string) {
  const user = await createTestUser(db, label);
  const workspace = await createTestWorkspace(db, {
    ownerId: user.id,
    label: `${label}-ws`,
  });
  currentActor.value = {
    type: "user",
    id: user.id,
    name: null,
    email: null,
    image: null,
  };

  return { user, workspace };
}

/** `redirect()` reports itself by throwing; the destination rides on `digest`. */
async function destinationOf(run: Promise<void>): Promise<string> {
  try {
    await run;
  } catch (thrown) {
    const digest = (thrown as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2] ?? "";
    throw thrown;
  }

  throw new Error("expected a redirect, and the action returned instead");
}

describe("createConversation", () => {
  it("creates exactly one conversation and navigates to it", async () => {
    const { user, workspace } = await scenario("action-one");

    const destination = await destinationOf(createConversation(workspace.id));

    const chats = await listChats(workspace.id, user.id);
    expect(chats).toHaveLength(1);
    expect(destination).toBe(`/w/${workspace.id}/c/${chats[0]!.id}`);
  });

  it("creates a second rather than reusing the first", async () => {
    const { user, workspace } = await scenario("action-second");

    await destinationOf(createConversation(workspace.id));
    await destinationOf(createConversation(workspace.id));

    expect(await listChats(workspace.id, user.id)).toHaveLength(2);
  });

  it("refuses at the cap, writing no row", async () => {
    const { user, workspace } = await scenario("action-capped");
    const cap = DEFAULT_PLAN_LIMITS.conversations;

    for (let made = 0; made < cap; made++) {
      await destinationOf(createConversation(workspace.id));
    }

    const destination = await destinationOf(createConversation(workspace.id));

    expect(destination).toContain(`${CAP_PARAM}=conversations`);
    // The fragment is what scrolls the notice into view — #171 exists for it.
    expect(destination).toContain("#conversations-heading");
    expect(await listChats(workspace.id, user.id)).toHaveLength(cap);
  });

  /* The cap must not close the chat-turn path: `getOrCreateChat` inserts at zero,
     where a refusal would drop the question rather than decline an action. */
  it("leaves the chat-turn path able to open a conversation at zero", async () => {
    const { user, workspace } = await scenario("action-turn");

    // A stale id, not an absent one: that path falls through to
    // `getOrCreateChat`, where a cap would refuse a turn rather than an action.
    const chat = await resolveChatForTurn(
      workspace.id,
      user.id,
      "00000000-0000-4000-8000-000000000000",
    );

    expect(chat.id).toBeTruthy();
    expect(await listChats(workspace.id, user.id)).toHaveLength(1);
  });

  it("creates nothing for a guest", async () => {
    const { workspace, user } = await scenario("action-guest");
    currentActor.value = { type: "guest", id: "guest-1" };

    await expect(createConversation(workspace.id)).rejects.toThrow(/404/);

    expect(await listChats(workspace.id, user.id)).toEqual([]);
  });

  /* The demo badges itself read-only, and until ADR 040 a signed-in reader could
     still start conversations in it. */
  it("creates nothing in the demo, for a signed-in reader", async () => {
    const user = await createTestUser(db, "action-demo");
    const demo = await findOrCreateDemoWorkspace(db);
    currentActor.value = {
      type: "user",
      id: user.id,
      name: null,
      email: null,
      image: null,
    };

    await expect(createConversation(demo.id)).rejects.toThrow(/404/);

    expect(await listChats(demo.id, user.id)).toEqual([]);
  });
});

describe("deleteConversationTurn", () => {
  async function conversation(label: string) {
    const { user, workspace } = await scenario(label);
    const chat = await getOrCreateChat(workspace.id, user.id);

    await appendMessages(workspace.id, user.id, chat.id, [
      { role: "user", content: "A question" },
      { role: "assistant", content: "An answer" },
    ]);

    const stored = await listChatMessages(workspace.id, user.id, chat.id);
    return { user, workspace, chat, stored };
  }

  it("removes the exchange and says so", async () => {
    const { user, workspace, chat, stored } = await conversation("turn-delete");

    expect(
      await deleteConversationTurn(workspace.id, chat.id, stored[0]!.id),
    ).toEqual({ deleted: true });

    expect(await listChatMessages(workspace.id, user.id, chat.id)).toEqual([]);
  });

  /* The caller hides the turn before asking, so a refusal it cannot see would
     leave a message off screen that is still in the database. */
  it("reports the miss rather than throwing", async () => {
    const { workspace, chat } = await conversation("turn-miss");

    expect(
      await deleteConversationTurn(
        workspace.id,
        chat.id,
        "00000000-0000-4000-8000-000000000000",
      ),
    ).toEqual({ deleted: false });
  });

  it("refuses on the demo, where nothing is writable", async () => {
    const { workspace, chat, stored } = await conversation("turn-demo");
    const demo = await findOrCreateDemoWorkspace(db);

    // ADR 040: `"write"` is refused there, so the id never reaches the query.
    await expect(
      deleteConversationTurn(demo.id, chat.id, stored[0]!.id),
    ).rejects.toThrow(/404/);

    expect(
      await listChatMessages(workspace.id, currentActor.value!.id, chat.id),
    ).toHaveLength(2);
  });
});
