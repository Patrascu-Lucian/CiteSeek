export type WebGpuSupport =
  | { status: "checking" }
  | { status: "available" }
  /** Every `reason` needs matching copy in `components/local/webgpu-gate.tsx`. */
  | { status: "unavailable"; reason: "no-api" | "no-adapter" | "errored" };

type NavigatorWithGpu = Navigator & {
  gpu?: { requestAdapter: () => Promise<unknown> };
};

/**
 * `navigator.gpu` existing is not the answer — a browser can expose it and still
 * refuse a device. ADR 027 has the rest.
 */
export async function detectWebGpu(
  navigatorLike: NavigatorWithGpu = navigator,
): Promise<WebGpuSupport> {
  if (!navigatorLike.gpu) return { status: "unavailable", reason: "no-api" };

  try {
    const adapter = await navigatorLike.gpu.requestAdapter();

    return adapter
      ? { status: "available" }
      : { status: "unavailable", reason: "no-adapter" };
  } catch {
    // Throwing rather than resolving null is not in the spec, but a browser
    // whose WebGPU throws on probe is not one to hand a model to.
    return { status: "unavailable", reason: "errored" };
  }
}
