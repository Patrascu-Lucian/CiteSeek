import { hydrated } from "./hydration";
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
