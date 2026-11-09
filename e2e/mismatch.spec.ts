import { useTheme, violationsOn } from "./axe";
import { hydrated } from "./hydration";
import { expect, test } from "./signed-in";

/** One vector another model wrote, in a suite configured for the fake: what
 * Preview held during the 1.9.1 smoke test, from the reader's side. */
const VECTOR = `[${new Array<number>(768).fill(0.036).join(",")}]`;

for (const theme of ["light", "dark"] as const) {
  test(`a mismatch is refused by name, clean under axe (${theme})`, async ({
    page,
    signedIn,
  }) => {
    const { sql, workspaceId } = signedIn;

    const [document] = await sql<{ id: string }[]>`
      insert into documents (workspace_id, filename, mime_type, size_bytes, status, content_text, chunk_count)
      values (${workspaceId}, 'handbook.pdf', 'application/pdf', 2048, 'ready', repeat('x', 200), 1)
      returning id`;
    await sql`
      insert into chunks (document_id, workspace_id, chunk_index, content, char_start, char_end, embedding, embedding_model)
      values (${document!.id}, ${workspaceId}, 0, repeat('x', 200), 0, 200, ${VECTOR}::vector, 'gemini-embedding-001')`;

    await useTheme(page, theme);
    await page.goto(`/w/${workspaceId}`);
    await hydrated(page, "textarea");
    await page
      .getByRole("textbox", { name: /ask a question/i })
      .fill("When is reimbursement paid?");
    await page.getByRole("button", { name: /send/i }).click();

    const refusal = page.locator('[data-refusal="embedding_model_mismatch"]');
    await expect(refusal).toBeVisible();
    await expect(refusal).toContainText(/cannot be searched right now/i);
    await expect(refusal.getByRole("link")).toHaveCount(0);

    expect(await violationsOn(page, "[data-refusal]")).toEqual([]);
  });
}
