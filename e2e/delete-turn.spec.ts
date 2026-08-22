import AxeBuilder from "@axe-core/playwright";
import { hydrated } from "./hydration";
import { expect, test } from "./signed-in";

/** The reload is the point: it separates hiding a turn from deleting one. */
test("an exchange is gone, and stays gone", async ({ page, signedIn }) => {
  const { sql, workspaceId, userId } = signedIn;

  await sql`
    insert into documents (workspace_id, filename, mime_type, size_bytes, status, content_text, chunk_count)
    values (${workspaceId}, 'handbook.pdf', 'application/pdf', 2048, 'ready', repeat('x', 200), 3)`;

  const [chat] = await sql<{ id: string }[]>`
    insert into chats (workspace_id, user_id, title) values (${workspaceId}, ${userId}, 'Leave')
    returning id`;

  await sql`
    insert into messages (chat_id, position, role, content) values
      (${chat!.id}, 0, 'user', 'How much leave?'),
      (${chat!.id}, 1, 'assistant', 'Twenty-eight days.'),
      (${chat!.id}, 2, 'user', 'And carry-over?'),
      (${chat!.id}, 3, 'assistant', 'Five days.')`;

  await page.goto(`/w/${workspaceId}/c/${chat!.id}`);

  const trigger = page.getByRole("button", {
    name: /^Delete the exchange starting “How much leave/,
  });
  await hydrated(page, "[aria-labelledby='chat-heading'] button");

  // Untappable while hidden, so the hover is a step rather than scenery.
  await page.getByText("How much leave?").hover();
  await trigger.click();

  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /delete exchange/i })
    .click();

  await expect(page.getByText("How much leave?")).toBeHidden();
  await expect(page.getByText("And carry-over?")).toBeVisible();

  await page.reload();

  await expect(page.getByText("And carry-over?")).toBeVisible();
  await expect(page.getByText("How much leave?")).toBeHidden();
  await expect(page.getByText("Twenty-eight days.")).toBeHidden();
});

test("the demo offers no delete, because it stores nothing", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("textbox", { name: /ask a question/i }).waitFor();

  await expect(
    page.locator("[aria-labelledby='chat-heading']").getByRole("button", {
      name: /delete the exchange/i,
    }),
  ).toHaveCount(0);
});

test("the control is reachable without a pointer, and axe is clean", async ({
  page,
  signedIn,
}) => {
  const { sql, workspaceId, userId } = signedIn;

  const [chat] = await sql<{ id: string }[]>`
    insert into chats (workspace_id, user_id, title) values (${workspaceId}, ${userId}, 'Leave')
    returning id`;
  await sql`
    insert into messages (chat_id, position, role, content) values
      (${chat!.id}, 0, 'user', 'How much leave?'),
      (${chat!.id}, 1, 'assistant', 'Twenty-eight days.')`;

  await page.goto(`/w/${workspaceId}/c/${chat!.id}`);

  const trigger = page.getByRole("button", {
    name: /^Delete the exchange starting “How much leave/,
  });

  // Hover and focus; the hold is in `turn-actions.test.tsx`. On opacity, which
  // `toBeVisible` ignores.
  const actions = page.locator("[data-turn-actions]").first();
  await expect(actions).toHaveCSS("opacity", "0");

  await page.getByText("How much leave?").hover();
  await expect(actions).toHaveCSS("opacity", "1");

  // Focusable while hidden, so reaching it never depends on a pointer.
  await page.mouse.move(0, 0);
  await expect(actions).toHaveCSS("opacity", "0");
  await trigger.focus();
  await expect(actions).toHaveCSS("opacity", "1");

  // Square, and sitting exactly on WCAG 2.5.8's 24px floor — so a shrink of any
  // size fails here rather than only in a manual pass.
  const box = await trigger.boundingBox();
  expect(box).toMatchObject({ width: 24, height: 24 });

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .include("[aria-labelledby='chat-heading']")
    .analyze();

  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.html),
    })),
  ).toEqual([]);
});

/** Editing clears from the question onward, then asks through the ordinary
 * route. The reload is what separates a hidden tail from a deleted one. */
test("editing a question clears what followed it", async ({
  page,
  signedIn,
}) => {
  const { sql, workspaceId, userId } = signedIn;

  await sql`
    insert into documents (workspace_id, filename, mime_type, size_bytes, status, content_text, chunk_count)
    values (${workspaceId}, 'handbook.pdf', 'application/pdf', 2048, 'ready', repeat('x', 200), 3)`;

  const [chat] = await sql<{ id: string }[]>`
    insert into chats (workspace_id, user_id, title) values (${workspaceId}, ${userId}, 'Leave')
    returning id`;
  await sql`
    insert into messages (chat_id, position, role, content) values
      (${chat!.id}, 0, 'user', 'How much leave?'),
      (${chat!.id}, 1, 'assistant', 'Twenty-eight days.'),
      (${chat!.id}, 2, 'user', 'And carry-over?'),
      (${chat!.id}, 3, 'assistant', 'Five days.')`;

  await page.goto(`/w/${workspaceId}/c/${chat!.id}`);
  await hydrated(page, "[aria-labelledby='chat-heading'] button");

  await page.getByText("How much leave?").hover();
  await page
    .getByRole("button", { name: /^Edit the question “How much leave/ })
    .click();

  const field = page.getByRole("textbox", { name: /edit your question/i });
  await field.fill("How much annual leave?");
  await page.getByRole("button", { name: /ask again/i }).click();

  // The old question and everything under it, gone from the database.
  await expect(page.getByText("And carry-over?")).toBeHidden();

  await page.reload();
  await expect(page.getByText("And carry-over?")).toBeHidden();
  await expect(page.getByText("Twenty-eight days.")).toBeHidden();
});

/** The bug: the SDK's ids are base62 and the stored ones are uuids, so the turn
 * you just asked could not be named to the server. Editing twice is what shows
 * it — the first edit works, the second names a message the database never had. */
test("a question asked this session can be edited too", async ({
  page,
  signedIn,
}) => {
  const { sql, workspaceId, userId } = signedIn;

  await sql`
    insert into documents (workspace_id, filename, mime_type, size_bytes, status, content_text, chunk_count)
    values (${workspaceId}, 'handbook.pdf', 'application/pdf', 2048, 'ready', repeat('x', 200), 3)`;

  const [chat] = await sql<{ id: string }[]>`
    insert into chats (workspace_id, user_id, title) values (${workspaceId}, ${userId}, 'Leave')
    returning id`;
  await sql`
    insert into messages (chat_id, position, role, content) values
      (${chat!.id}, 0, 'user', 'react'),
      (${chat!.id}, 1, 'assistant', 'An answer about react.')`;

  await page.goto(`/w/${workspaceId}/c/${chat!.id}`);
  await hydrated(page, "[aria-labelledby='chat-heading'] button");

  async function editTo(from: string, to: string) {
    await page.getByText(from, { exact: true }).hover();
    await page
      .getByRole("button", { name: new RegExp(`^Edit the question “${from}`) })
      .click();
    await page.getByRole("textbox", { name: /edit your question/i }).fill(to);
    await page.getByRole("button", { name: /ask again/i }).click();
    await expect(page.getByText(to, { exact: true })).toBeVisible();
  }

  await editTo("react", "angular");
  // The second edit names a question that only ever existed in this session.
  await editTo("angular", "svelte");

  // Not a count: Next's route announcer is an empty `role="alert"` on every page.
  await expect(page.getByText(/is unchanged/i)).toHaveCount(0);
  await expect(page.getByText("react", { exact: true })).toBeHidden();
  await expect(page.getByText("angular", { exact: true })).toBeHidden();
});
