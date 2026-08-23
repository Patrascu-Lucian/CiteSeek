import { request } from "@playwright/test";

/**
 * One unanswerable question before any spec starts. Two refusal tests failed on
 * the first run after every build and passed on re-run, which `retries: 2` hid
 * on CI. The cost is the first vector search touching the HNSW index, not Next
 * compiling — warming `/demo` alone did not fix it. Unanswerable on purpose:
 * nothing clears the floor, so this warms the slow path and calls no model.
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
