import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Actor } from "@/lib/auth/actor";
import { listChats, resolveChatForTurn } from "@/lib/chats/queries";
import {
  cleanupTestRows,
  createTestClient,
  createTestUser,
  createTestWorkspace,
} from "@/lib/db/test-helpers";
import { CAP_PARAM } from "@/lib/limits/caps";
import { DEFAULT_PLAN_LIMITS } from "@/lib/limits/config";

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

  it("refuses at the conversation cap, writing no row", async () => {
    const { workspace, user } = await scenario("new-chat-cap");
    const { POST } = await import("./route");
    const request = () =>
      POST(new Request("http://test/w/x/c/new", { method: "POST" }), {
        params: Promise.resolve({ workspaceId: workspace.id }),
      });

    for (let index = 0; index < DEFAULT_PLAN_LIMITS.conversations; index++) {
      expect((await request()).status).toBe(303);
    }

    const refused = await request();

    // Still a 303: a form POST has nowhere to render a JSON body, so the refusal
    // rides back on the redirect and the workspace names it.
    expect(refused.status).toBe(303);
    expect(refused.headers.get("location")).toContain(
      `${CAP_PARAM}=conversations`,
    );
    // The refusal renders below the documents, so the fragment is what puts it
    // on screen rather than somewhere the reader has to scroll to find.
    expect(refused.headers.get("location")).toContain("#conversations-heading");
    expect(await listChats(workspace.id, user.id)).toHaveLength(
      DEFAULT_PLAN_LIMITS.conversations,
    );
  });

  /* The trap this cap was placed to avoid. `resolveChatForTurn` falls back to
     `getOrCreateChat` for a stale id, so a cap enforced there would refuse a
     chat turn rather than a create action — losing the reader's question. */
  it("leaves the chat-turn path able to open a conversation at zero", async () => {
    const { workspace, user } = await scenario("new-chat-implicit");

    // Well-formed but unknown. A malformed id never reaches the fallback at all
    // — Postgres rejects the uuid cast first (`docs/backlog.md`).
    const resolved = await resolveChatForTurn(
      workspace.id,
      user.id,
      "00000000-0000-4000-8000-000000000000",
    );

    expect(resolved.id).toBeTruthy();
    expect(await listChats(workspace.id, user.id)).toHaveLength(1);
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
