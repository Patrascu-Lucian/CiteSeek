import { expect, test } from "@playwright/test";

import { GUEST_EXIT, hydrated, WORDMARK } from "./hydration";

test.describe("guest mode", () => {
  test("reading the landing page starts no session", async ({
    page,
    context,
  }) => {
    /*
      `/demo` is a GET that sets a cookie, and Next prefetches `<Link>` targets —
      so reading the landing page handed every visitor a session. `networkidle`
      because a prefetch has not happened yet when `load` fires.
    */
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(
      (await context.cookies()).map((cookie) => cookie.name),
    ).not.toContain("citeseek.guest");
  });

  test("a visitor can enter the demo and see the workspace without signing up", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(page, WORDMARK);
    await page.getByRole("link", { name: /try the demo/i }).click();

    await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /demo/i }),
    ).toBeVisible();
    await expect(page.getByText(/read-only demo/i)).toBeVisible();
  });

  test("the demo is read-only, offering sign-in rather than upload", async ({
    page,
  }) => {
    await page.goto("/demo");

    await expect(
      page.getByRole("heading", { level: 2, name: /documents/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /sign in to upload/i }),
    ).toBeVisible();
  });

  test("guest access survives a reload", async ({ page }) => {
    await page.goto("/demo");
    const workspaceUrl = page.url();

    await page.reload();

    await expect(page).toHaveURL(workspaceUrl);
    await expect(
      page.getByRole("heading", { level: 1, name: /demo/i }),
    ).toBeVisible();
  });
});

test.describe("route protection", () => {
  test("a signed-out visitor is redirected to sign-in, not shown an error", async ({
    page,
  }) => {
    await page.goto("/w/00000000-0000-0000-0000-000000000000");

    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=/);
    await expect(
      page.getByRole("heading", { name: /sign in to citeseek/i }),
    ).toBeVisible();
  });

  test("a guest cannot reach a workspace that is not the demo", async ({
    page,
  }) => {
    // Establish a guest session first, so this exercises authorization rather
    // than the proxy's has-a-cookie check.
    await page.goto("/demo");
    await page.goto("/w/00000000-0000-0000-0000-000000000000");

    // Denied and not-found are intentionally the same response, so workspace ids
    // cannot be enumerated by comparing them.
    await expect(
      page.getByRole("heading", { name: /workspace not available/i }),
    ).toBeVisible();
  });

  test("a tampered guest cookie is rejected", async ({ page, context }) => {
    await page.goto("/demo");
    const workspaceUrl = page.url();

    const cookies = await context.cookies();
    const guestCookie = cookies.find((c) => c.name === "citeseek.guest");
    expect(guestCookie).toBeDefined();

    // Flip the payload while keeping a plausible shape. The HMAC must reject it.
    await context.clearCookies();
    await context.addCookies([
      {
        ...guestCookie!,
        value: `${Buffer.from(
          JSON.stringify({ id: "forged", iat: 0, exp: 99999999999 }),
        ).toString("base64url")}.notavalidsignature`,
      },
    ]);

    await page.goto(workspaceUrl);

    await expect(
      page.getByRole("heading", { name: /workspace not available/i }),
    ).toBeVisible();
  });
});

test.describe("navigation", () => {
  /*
    These replace four "back link" tests. The link went when the header became a
    nav — it pointed where the wordmark already does. The property they protected
    still holds: every page has a visible, keyboard-reachable way out.
  */
  test("every page offers a way home", async ({ page }) => {
    for (const path of ["/", "/sign-in", "/demo-unavailable"]) {
      await page.goto(path);
      await expect(
        page.getByRole("navigation", { name: /main/i }).getByRole("link", {
          name: "CiteSeek",
        }),
      ).toBeVisible();
    }
  });

  test("the wordmark returns to the landing page", async ({ page }) => {
    await page.goto("/sign-in");
    await hydrated(page, WORDMARK);
    await page.getByRole("link", { name: "CiteSeek" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /ask your documents/i }),
    ).toBeVisible();
  });

  test("the header is the first stop after the skip link", async ({ page }) => {
    await page.goto("/sign-in");

    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // wordmark

    await expect(page.getByRole("link", { name: "CiteSeek" })).toBeFocused();
  });

  test("a session gets links to its workspace and account", async ({
    page,
  }) => {
    // The reason the nav exists: three destinations rather than two. An
    // anonymous visitor gets neither, because both would only redirect them to
    // sign-in — a destination that is really a detour is worse than no link.
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: /main/i });
    await expect(nav.getByRole("link", { name: /workspace/i })).toHaveCount(0);

    await page.goto("/demo");
    await expect(nav.getByRole("link", { name: /workspace/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /account/i })).toBeVisible();
  });

  test("tells a guest the only workspace they can reach is the demo", async ({
    page,
  }) => {
    // `/w` is polymorphic — a signed-in user lands on their own workspace, a
    // guest on the shared read-only demo. One link, so the label has to carry
    // the difference; "Workspace" on its own is a small lie to a guest.
    await page.goto("/demo");

    const nav = page.getByRole("navigation", { name: /main/i });
    await expect(
      nav.getByRole("link", { name: /demo workspace/i }),
    ).toBeVisible();

    // And exactly one link there, not a "Workspace" and a "Demo" that resolve
    // to the same page.
    await expect(nav.getByRole("link", { name: /workspace/i })).toHaveCount(1);
  });

  test("a guest reaching the account page is told why it is empty", async ({
    page,
  }) => {
    await page.goto("/demo");
    await page
      .getByRole("navigation", { name: /main/i })
      .getByRole("link", { name: /account/i })
      .click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByRole("heading", { level: 2, name: /guest session/i }),
    ).toBeVisible();
    // Nothing to delete, so nothing that offers to.
    await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);
  });

  test("a signed-out visitor is redirected away from /account", async ({
    page,
  }) => {
    await page.goto("/account");

    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("/w sends a guest to the demo workspace", async ({ page }) => {
    await page.goto("/demo");
    await page.goto("/w");

    await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /demo/i }),
    ).toBeVisible();
  });

  test("/w sends a signed-out visitor to sign-in", async ({ page }) => {
    await page.goto("/w");

    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("documents in the demo workspace", () => {
  test("shows the read-only workspace without an upload control", async ({
    page,
  }) => {
    // The demo is shared, seeded state. An upload control that then failed
    // server-side would be worse than not offering it.
    await page.goto("/demo");

    await expect(
      page.getByRole("heading", { level: 2, name: /documents/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /drop files here/i }),
    ).toHaveCount(0);
    await expect(page.getByText(/read-only/i).first()).toBeVisible();
  });

  test("offers no destructive controls to a read-only visitor", async ({
    page,
  }) => {
    await page.goto("/demo");

    await expect(page.getByRole("button", { name: /^delete/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /retry/i })).toHaveCount(0);
  });

  test("lists the seeded document, so there is something to ask about", async ({
    page,
  }) => {
    // The demo is seeded now: a guest can only read it, so with no document every
    // question returns the same refusal. The empty state is covered in
    // `document-list.test.tsx`, without depending on seed data.
    await page.goto("/demo");

    await expect(
      page.getByText(/northwind-remote-work-handbook/i),
    ).toBeVisible();
    await expect(page.getByText(/no documents yet/i)).toHaveCount(0);
  });

  test("offers a guest no account-deletion control", async ({ page }) => {
    // A guest has no account. Showing the control would promise something the
    // route rejects.
    await page.goto("/demo");

    await expect(
      page.getByRole("button", { name: /delete account/i }),
    ).toHaveCount(0);
  });
});

test.describe("ending a session", () => {
  test("a guest can leave the demo and the session is actually gone", async ({
    page,
    context,
  }) => {
    // The assertion that matters is the second navigation, not the redirect: a
    // button that returns you home while leaving the cookie in place looks
    // identical and logs nobody out.
    await page.goto("/demo");
    const workspaceUrl = page.url();

    // The exit lives on `/account` now: the header offers a guest the way *in*
    // instead, since abandoning read access to a public demo exposes nothing.
    await page.goto("/account");
    await page.getByRole("button", { name: /leave the demo/i }).click();
    await expect(page).toHaveURL(/\/$/);

    /*
      Poll the cookie rather than read it once: `toHaveURL` matches as soon as the
      client-side URL changes, which can precede the response carrying the
      `Set-Cookie` deletion. Waiting on rendered content instead narrowed the
      window without closing it, and failed half the time against a cold server.
    */
    await expect
      .poll(
        async () =>
          (await context.cookies()).some((c) => c.name === "citeseek.guest"),
        { message: "the guest cookie should be deleted on leaving the demo" },
      )
      .toBe(false);

    await page.goto(workspaceUrl);
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("shows the guest they are in a guest session", async ({ page }) => {
    await page.goto("/demo");

    // The badge and the nav label, since the header no longer spells out
    // "Guest session" beside an exit control.
    await expect(page.getByText(/read-only demo/i)).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: /main/i })
        .getByRole("link", { name: /demo workspace/i }),
    ).toBeVisible();
  });

  test("offers no session exit to a visitor who has none", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(
      page.getByRole("button", { name: /leave the demo|sign out/i }),
    ).toHaveCount(0);
  });

  test("the exit control is keyboard operable", async ({ page }) => {
    await page.goto("/demo");
    await page.goto("/account");
    await hydrated(page, GUEST_EXIT);

    const leave = page.getByRole("button", { name: /leave the demo/i });
    await leave.focus();
    await expect(leave).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("sign-in page", () => {
  test("offers both providers and links to the demo", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(
      page.getByRole("button", { name: /continue with github/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue with google/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /try the demo/i }),
    ).toBeVisible();
  });

  test("announces a failed sign-in without losing either provider", async ({
    page,
  }) => {
    await page.goto("/sign-in?error=OAuthAccountNotLinked");

    // Scoped to `main`: Next injects its route announcer as a page-level
    // `role="alert"`, so an unscoped lookup is always ambiguous here.
    const alert = page.getByRole("main").getByRole("alert");

    await expect(alert).toContainText(/already registered with a different/i);
    // The half that makes it a refusal rather than an explanation.
    await expect(alert).toContainText(/add this one from your account page/i);
    await expect(
      page.getByRole("button", { name: /continue with github/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue with google/i }),
    ).toBeVisible();
  });

  test("is reachable by keyboard from the landing page", async ({ page }) => {
    await page.goto("/");

    const cta = page.getByRole("link", { name: /get started/i });

    // Tabs until reached rather than a fixed count, which asserts the shape of
    // the navigation instead of the thing that matters. A hard-coded count broke
    // the moment the header was added — a layout change, not a lost affordance.
    for (let i = 0; i < 10; i += 1) {
      if (await cta.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }

    await expect(cta).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("the navigation row", () => {
  /* The current item is bold and the rest are not, so without a reserved width
     every route change nudged the whole row sideways. */
  test("does not shift when the current destination changes", async ({
    page,
  }) => {
    await page.goto("/demo");

    const account = page.getByRole("link", { name: "Account" });
    const before = await account.boundingBox();

    await page.getByRole("link", { name: "Usage" }).click();
    await expect(page).toHaveURL(/\/usage$/);

    const after = await account.boundingBox();

    expect(before).not.toBeNull();
    expect(Math.round(after!.x)).toBe(Math.round(before!.x));
    expect(Math.round(after!.width)).toBe(Math.round(before!.width));
  });
});
