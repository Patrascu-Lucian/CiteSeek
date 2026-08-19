import { describe, expect, it, vi } from "vitest";

import { nodeModelCacheDir, useNodeModelCache } from "./model-cache";

describe("where Node caches model weights", () => {
  it("keeps the weights out of the dependency tree", () => {
    // The whole point: transformers.js defaults to `.cache/` inside its own
    // package, and a 1.7 GB file there made `pnpm build` fail intermittently.
    const dir = nodeModelCacheDir({ HOME: "/home/lucian" });

    expect(dir).not.toMatch(/node_modules/);
    expect(dir).toBe("/home/lucian/.cache/citeseek-transformers");
  });

  it("reads USERPROFILE, which is the one Windows sets", () => {
    expect(nodeModelCacheDir({ USERPROFILE: "C:/Users/lucian" })).toBe(
      "C:/Users/lucian/.cache/citeseek-transformers",
    );
  });

  it("takes an explicit override ahead of the home directory", () => {
    expect(
      nodeModelCacheDir({ CITESEEK_MODEL_CACHE: "/mnt/big", HOME: "/home/x" }),
    ).toBe("/mnt/big");
  });

  it("ignores an override that is only whitespace", () => {
    // An unset variable in a shell script is an empty string, not absent, and
    // `cacheDir = ""` would put the weights in the working directory.
    expect(
      nodeModelCacheDir({ CITESEEK_MODEL_CACHE: "  ", HOME: "/home/x" }),
    ).toBe("/home/x/.cache/citeseek-transformers");
  });

  it("leaves the default alone when there is no home to write to", () => {
    expect(nodeModelCacheDir({})).toBeNull();
  });
});

describe("applying it to the library", () => {
  it("does nothing in a browser, where there is no filesystem", () => {
    // `cacheDir` is null wherever transformers.js finds no filesystem, so this
    // is the library's own runtime check rather than a second guess at it.
    const env = { cacheDir: null };

    useNodeModelCache(env);

    expect(env.cacheDir).toBeNull();
  });

  it("redirects a filesystem cache away from node_modules", () => {
    // Stubbed rather than read: a runner with neither variable set would leave
    // the default in place and pass for the wrong reason.
    vi.stubEnv("CITESEEK_MODEL_CACHE", "/mnt/models");
    const env = { cacheDir: "/repo/node_modules/@huggingface/x/.cache/" };

    useNodeModelCache(env);

    expect(env.cacheDir).toBe("/mnt/models");
    vi.unstubAllEnvs();
  });
});
