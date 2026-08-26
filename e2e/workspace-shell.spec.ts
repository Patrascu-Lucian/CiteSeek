import { hydrated } from "./hydration";
import { watchFor } from "./watch-for";
import { expect, test } from "./signed-in";

/**
 * The shell survives a conversation change (ADR 041).
 *
 * **Node identity, not elapsed time.** A threshold would assert the speed of
 * whichever machine ran it — the mistake `navigation.spec.ts` made.
 */

const CONVERSATION_LINK =
  "aside a, [aria-labelledby='conversations-heading'] a";

test("switching conversations keeps the shell mounted", async ({
  page,
  signedIn,
}) => {
  const { sql, workspaceId, userId } = signedIn;

  await sql`
    insert into documents (workspace_id, filename, mime_type, size_bytes, status, content_text, chunk_count)
    values (${workspaceId}, 'handbook.pdf', 'application/pdf', 2048, 'ready', repeat('x', 200), 3)`;

  const chats = await sql<{ id: string }[]>`
    insert into chats (workspace_id, user_id, title, updated_at)
    select ${workspaceId}, ${userId}, 'Conversation ' || g, now() - (g || ' minutes')::interval
    from generate_series(1, 2) g
    returning id`;

  for (const [index, chat] of chats.entries()) {
    await sql`
      insert into messages (chat_id, position, role, content)
      values (${chat.id}, 0, 'user', ${`Question number ${index + 1}`})`;
  }

  await page.goto(`/w/${workspaceId}`);
  await hydrated(page, CONVERSATION_LINK);

  // An expando survives reconciliation and not a remount — the distinction.
  await page.evaluate(() => {
    const tag = (selector: string, value: string) => {
      const node: (Element & { __shellTag?: string }) | null =
        document.querySelector(selector);
      if (node) node.__shellTag = value;
    };

    tag("main", "main");
    tag("[aria-labelledby='documents-heading']", "documents");
    tag("[aria-labelledby='conversations-heading']", "conversations");
    // The control. Chat is the per-route half and *must* be rebuilt, so its tag
    // is what proves this probe can still report a remount.
    tag("[aria-labelledby='chat-heading']", "chat");
  });

  const second = page.getByRole("link", { name: /Conversation 2/ });
  await second.click();
  await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/c/`));
  await expect(page.getByText("Question number 2")).toBeVisible();

  const survived = await page.evaluate(() => {
    const tagOf = (selector: string) => {
      const node: (Element & { __shellTag?: string }) | null =
        document.querySelector(selector);
      return node?.__shellTag ?? null;
    };

    return {
      main: tagOf("main"),
      documents: tagOf("[aria-labelledby='documents-heading']"),
      conversations: tagOf("[aria-labelledby='conversations-heading']"),
      chat: tagOf("[aria-labelledby='chat-heading']"),
    };
  });

  expect(survived).toEqual({
    main: "main",
    documents: "documents",
    conversations: "conversations",
    chat: null,
  });
});

/* A layout's data is not refetched on a client navigation, so the write has to
   invalidate it. Without that the new conversation is missing from the list
   until something else refreshes the route. */
test("a new conversation appears in the list without a reload", async ({
  page,
  signedIn,
}) => {
  const { sql, workspaceId } = signedIn;

  await sql`
    insert into documents (workspace_id, filename, mime_type, size_bytes, status, content_text, chunk_count)
    values (${workspaceId}, 'handbook.pdf', 'application/pdf', 2048, 'ready', repeat('x', 200), 3)`;

  await page.goto(`/w/${workspaceId}`);

  const list = page.locator("[aria-labelledby='conversations-heading']");
  await expect(list.getByRole("link")).toHaveCount(0);

  await hydrated(
    page,
    "[aria-labelledby='conversations-heading'] button[type='submit']",
  );
  await page.getByRole("button", { name: /new conversation/i }).click();

  await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/c/`));
  await expect(
    list.getByRole("link", { name: /untitled conversation/i }),
  ).toBeVisible();
});

/**
 * Without `loading.tsx` the destination does not commit for 1.7 s — the reader
 * waits on the page they left (ADR 045). Throttled because unthrottled the data
 * lands in ~190 ms and the fallback window shuts before anything can observe it.
 */
test("entering the workspace shows the skeleton", async ({
  page,
  signedIn,
}) => {
  // In the body, not at module scope, where it would slow the whole file. The
  // throttled navigation alone spends most of the default budget.
  test.slow();

  // Prefetch is declined: answered from the router's cache, the click never
  // suspends. Both headers, because Next 16's segment cache sends the second.
  const served: string[] = [];

  await page.route(
    (url) => url.pathname.startsWith("/w/"),
    async (route) => {
      const headers = route.request().headers();
      const prefetch =
        headers["next-router-prefetch"] ??
        headers["next-router-segment-prefetch"];

      if (prefetch !== undefined) {
        await route.abort();
        return;
      }

      // Every `/w/` path, not just the destination: the router cache is keyed by
      // segment, so the header's Usage link warms the same `[workspaceId]`
      // boundary this test is about.
      served.push(new URL(route.request().url()).pathname);
      await route.continue();
    },
  );

  await page.goto("/account");
  const link = page.getByRole("link", { name: "Workspace" }).first();
  await expect(link).toBeVisible();
  // Before throttling: an unhydrated link navigates as the browser, discarding
  // the observer below with the rest of the JavaScript context.
  await hydrated(page, 'header a[href^="/w/"]');

  // The header is in a layout above `/account`'s own loading boundary, so the
  // link is visible while that skeleton still is. Watching from there seeds a
  // match and the guard passes with `loading.tsx` deleted. Before the throttling
  // below, which this wait would otherwise have to sit through.
  await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0);

  const cdp = await page.context().newCDPSession(page);
  // Per session, and the emulation below is silently ignored without it — the
  // test would then run unthrottled and fail as if the skeleton had gone.
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });

  // `main`, not any busy element: a pending state on a component inside the
  // page would retire this guard silently.
  const sawSkeleton = await watchFor(page, 'main[aria-busy="true"]');

  // Snapshot rather than a flag the handler reads late: everything recorded by
  // now was issued before the click.
  const early = [...served];
  await link.click();
  // ~2.2 s throttled for this navigation, so the default 5 s leaves little room
  // on a slower runner and would fail as if the skeleton had gone.
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible({
    timeout: 20_000,
  });
  expect(page.url()).toContain(signedIn.workspaceId);

  // Asserted rather than assumed, and stated as what must not happen: no
  // prefetch is required, only that nothing reached the workspace. A Next
  // release that stops marking them would warm the cache silently, and the
  // skeleton would take the blame.
  expect(
    early,
    "the workspace was fetched before the click, so the router cache was warm",
  ).toEqual([]);

  expect(
    await sawSkeleton(),
    "no loading skeleton rendered on the way into the workspace",
  ).toBe(true);
});
