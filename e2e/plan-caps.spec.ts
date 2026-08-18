import { hydrated } from "./hydration";
import { expect, test } from "./signed-in";

/**
 * Rows put the workspace at the cap; the UI crosses it. The refusal a reader
 * meets is what is under test — the counting is `lib/limits`'.
 */

const UPLOAD_INPUT = 'input[type="file"]';

const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(600, 0x20)]);

test("refuses a fourth document and names the one worth deleting", async ({
  page,
  signedIn,
}) => {
  const { sql, workspaceId } = signedIn;

  // One of the three failed. A reader at the cap with a broken document must not
  // be told to delete a working one.
  await sql`
    insert into documents (workspace_id, filename, mime_type, size_bytes, status, content_text, chunk_count, error)
    select ${workspaceId}, 'report-' || g || '.pdf', 'application/pdf', 2048,
      (case when g = 1 then 'failed' else 'ready' end)::document_status,
      repeat('x', 200), 3,
      (case when g = 1 then 'Could not parse' else null end)
    from generate_series(1, 3) g`;

  await page.goto(`/w/${workspaceId}`);
  // Until the dropzone's handler is attached, the change event reaches nothing
  // and the upload silently never happens.
  await hydrated(page, UPLOAD_INPUT);
  await page.locator(UPLOAD_INPUT).setInputFiles({
    name: "fourth.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });

  await expect(
    page.getByText(/you have reached the limit of 3 documents/i),
  ).toBeVisible();
  await expect(
    page.getByText(
      /one of them failed to process — deleting that one frees a slot/i,
    ),
  ).toBeVisible();

  // Refused before ingestion, not after: a fourth row would mean the cap counted
  // and then let the write through anyway.
  const rows = await sql<{ count: string }[]>`
    select count(*) from documents where workspace_id = ${workspaceId}`;
  expect(Number(rows[0]!.count)).toBe(3);
});

test("refuses a fourth conversation and says to delete one", async ({
  page,
  signedIn,
}) => {
  const { sql, workspaceId, userId } = signedIn;

  await sql`
    insert into chats (workspace_id, user_id, title)
    select ${workspaceId}, ${userId}, 'Conversation ' || g from generate_series(1, 3) g`;

  await page.goto(`/w/${workspaceId}`);
  await hydrated(page, UPLOAD_INPUT);
  await page.getByRole("button", { name: /new conversation/i }).click();

  await expect(
    page.getByText(/you have reached the limit of 3 conversations/i),
  ).toBeVisible();
  await expect(
    page.getByText(/delete one below to start another/i),
  ).toBeVisible();

  const rows = await sql<{ count: string }[]>`
    select count(*) from chats where workspace_id = ${workspaceId}`;
  expect(Number(rows[0]!.count)).toBe(3);
});
