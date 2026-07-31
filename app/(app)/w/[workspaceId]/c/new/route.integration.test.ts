import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Actor } from "@/lib/auth/actor";
import { listChats } from "@/lib/chats/queries";
import {
  cleanupTestRows,
  createTestClient,
  createTestUser,
  createTestWorkspace,
} from "@/lib/db/test-helpers";

/**
 * Starting a conversation.
 *
 * These exist because the first version of this route was a `GET`, and Next
 * prefetches `<Link>` targets in the viewport — so merely rendering the page
 * executed the handler and created a conversation. Empty conversations appeared
 * on every load and every time the list re-rendered.
 */
const currentActor = vi.hoisted(() => ({ value: null as Actor | null }));
vi.mock("@/lib/auth/actor", () => ({
  getActor: () => Promise.resolve(currentActor.value),
}));

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

describe("POST /w/[workspaceId]/c/new", () => {
  /**
   * The regression guard. A route that creates a resource must not answer GET:
   * prefetchers, crawlers, link previews and tab-restore all issue GETs nobody
   * clicked, and any one of them would fill the list with empty conversations.
   */
  it("exposes no GET handler", async () => {
    const route = (await import("./route")) as Record<string, unknown>;

    expect(route.GET).toBeUndefined();
    expect(typeof route.POST).toBe("function");
  });

  it("creates exactly one conversation and redirects to it", async () => {
    const { workspace, user } = await scenario("new-chat");
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://test/w/x/c/new", { method: "POST" }),
      { params: Promise.resolve({ workspaceId: workspace.id }) },
    );

    // 303, not 307: a 307 preserves the method, so the browser would follow with
    // another POST at a page that does not accept one.
    expect(response.status).toBe(303);

    const chats = await listChats(workspace.id, user.id);
    expect(chats).toHaveLength(1);
    expect(response.headers.get("location")).toContain(`/c/${chats[0]!.id}`);
  });

  it("creates a second conversation rather than reusing the first", async () => {
    // Distinct from `getOrCreateChat`, which returns the most recent. "New"
    // means new, or the button would silently do nothing on a second press.
    const { workspace, user } = await scenario("new-chat-twice");
    const { POST } = await import("./route");
    const request = () =>
      POST(new Request("http://test/w/x/c/new", { method: "POST" }), {
        params: Promise.resolve({ workspaceId: workspace.id }),
      });

    await request();
    await request();

    expect(await listChats(workspace.id, user.id)).toHaveLength(2);
  });

  it("creates nothing for a guest", async () => {
    const { workspace, user } = await scenario("new-chat-guest");
    currentActor.value = { type: "guest", id: "guest-1" };
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://test/w/x/c/new", { method: "POST" }),
      { params: Promise.resolve({ workspaceId: workspace.id }) },
    );

    // 404, not the route's own guest redirect: workspace access is checked
    // first, and a guest has no access to a private workspace at all. The
    // redirect branch is for the demo, which a guest *can* read — and which a
    // partial unique index prevents a test creating a second of.
    expect(response.status).toBe(404);

    // The assertion that matters either way: nothing was written.
    expect(await listChats(workspace.id, user.id)).toEqual([]);
  });
});
