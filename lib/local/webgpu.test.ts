import { describe, expect, it, vi } from "vitest";

import { detectWebGpu } from "./webgpu";

type Nav = Parameters<typeof detectWebGpu>[0];

const withGpu = (requestAdapter: () => Promise<unknown>) =>
  ({ gpu: { requestAdapter } }) as Nav;

describe("detectWebGpu", () => {
  it("reports the API missing when there is no `navigator.gpu`", async () => {
    await expect(detectWebGpu({} as Nav)).resolves.toEqual({
      status: "unavailable",
      reason: "no-api",
    });
  });

  it("reports available when an adapter is granted", async () => {
    const gpu = withGpu(() => Promise.resolve({}));

    await expect(detectWebGpu(gpu)).resolves.toEqual({ status: "available" });
  });

  it("separates a null adapter from a missing API", async () => {
    // The distinction the reader sees: "your browser has no WebGPU" and "your
    // browser has it but this machine cannot provide a device" need different
    // copy, and only the second is worth suggesting a flag for.
    const gpu = withGpu(() => Promise.resolve(null));

    await expect(detectWebGpu(gpu)).resolves.toEqual({
      status: "unavailable",
      reason: "no-adapter",
    });
  });

  it("treats a throwing probe as unavailable rather than propagating", async () => {
    const gpu = withGpu(() => Promise.reject(new Error("denied")));

    await expect(detectWebGpu(gpu)).resolves.toEqual({
      status: "unavailable",
      reason: "errored",
    });
  });

  it("asks for an adapter rather than trusting the API's presence", async () => {
    // The whole point of the second step: a browser can expose `navigator.gpu`
    // and still refuse a device.
    const requestAdapter = vi.fn(() => Promise.resolve({}));

    await detectWebGpu(withGpu(requestAdapter));

    expect(requestAdapter).toHaveBeenCalledTimes(1);
  });
});
