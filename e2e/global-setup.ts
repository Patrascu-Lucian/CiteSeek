import { request } from "@playwright/test";

/**
 * Runs one unanswerable question through the demo before any spec starts.
 *
 * `chat.spec.ts`'s two refusal tests failed on the first suite run after every
 * `pnpm build` and passed on every re-run against the same build. Locally that
 * read as a flake; on CI `retries: 2` swallowed it, so the cost was paid on
 * attempt one and hidden by attempt two — a green check over a real wait.
 *
 * Warming `/demo` alone did not fix it. This is `next start` on a production
 * build, so routes are already compiled and the first-request cost is not
 * Next's: it is the first vector search touching the HNSW index, which only the
 * chat route performs. The refusal tests are the ones that expose it because
 * they assert on retrieval's own reply, with no streaming to wait behind.
 *
 * An unanswerable question on purpose. Nothing clears the relevance floor, so
 * the model is never called (ADR 011) — this warms exactly the slow path and
 * generates nothing.
 */
export default async function globalSetup() {
  const port = Number(process.env.E2E_PORT ?? 3000);
  const context = await request.newContext({
    baseURL: `http://localhost:${port}`,
  });

  try {
    // Follows the redirect into the seeded workspace and keeps the guest cookie.
    const demo = await context.get("/demo", { timeout: 60_000 });
    const workspaceId = /\/w\/([0-9a-f-]+)/.exec(demo.url())?.[1];

    if (!workspaceId) return;

    const warmed = await context.post(`/api/w/${workspaceId}/chat`, {
      timeout: 60_000,
      data: {
        messages: [
          {
            id: "warm-up",
            role: "user",
            parts: [{ type: "text", text: "Who won the world cup in 1998?" }],
          },
        ],
      },
    });
    await warmed.body();

    // The rest of what the suite opens. Sequentially, because the point is to
    // pay these costs once here rather than have every worker meet them at the
    // same moment — which is what a run started the instant a build finishes
    // does, and why the chat route alone was not enough.
    for (const path of [
      "/",
      "/about",
      "/privacy",
      "/terms",
      "/local",
      "/sign-in",
      `/w/${workspaceId}`,
      `/w/${workspaceId}/usage`,
    ]) {
      await context.get(path, { timeout: 60_000 });
    }
  } finally {
    await context.dispose();
  }
}
