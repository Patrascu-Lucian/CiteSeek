import { iPhone12 } from "./devices";
import { hydrated } from "./hydration";
import { expect, test } from "./signed-in";

test.use(iPhone12);

test("a touch screen shows the latest answer's Copy without a hold", async ({
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
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto(`/w/${workspaceId}/c/${chat!.id}`);
  await hydrated(page, "[aria-labelledby='chat-heading'] button");
  expect(await page.evaluate(() => matchMedia("(hover: none)").matches)).toBe(
    true,
  );

  // Opacity, because `toBeVisible` counts an element at opacity 0 as visible.
  const controlsOf = (text: string) =>
    page
      .getByRole("listitem")
      .filter({ hasText: text })
      .locator("[data-turn-actions]")
      .evaluate((controls) => getComputedStyle(controls).opacity);

  expect(await controlsOf("Five days.")).toBe("1");
  expect(await controlsOf("Twenty-eight days.")).toBe("0");
  expect(await controlsOf("And carry-over?")).toBe("0");

  await page
    .getByRole("button", { name: /^Copy the answer to “And carry-over/ })
    .tap();
  await expect(
    page.getByRole("button", { name: /answer copied/i }),
  ).toBeVisible();
});
