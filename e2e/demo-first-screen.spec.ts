import { expect, test } from "@playwright/test";

import { DEMO_EXAMPLE_QUESTIONS } from "@/lib/demo/example-questions";

import { iPhone12 } from "./devices";

for (const [screenName, use] of [
  ["a 1366×768 laptop", { viewport: { width: 1366, height: 768 } }],
  ["an iPhone 12", iPhone12],
] as const) {
  test.describe(`on ${screenName}`, () => {
    test.use(use);

    test("the demo's first question is on the first screen", async ({
      page,
    }) => {
      await page.goto("/demo");

      const starter = page.getByRole("button", {
        name: DEMO_EXAMPLE_QUESTIONS[0],
      });
      await expect(starter).toBeVisible();
      const box = await starter.boundingBox();

      expect(box!.y + box!.height).toBeLessThanOrEqual(
        page.viewportSize()!.height,
      );
    });
  });
}
