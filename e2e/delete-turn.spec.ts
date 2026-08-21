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

  const trigger = page.getByRole("button", { name: /How much leave\?/ });
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

  const trigger = page.getByRole("button", { name: /How much leave\?/ });

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
