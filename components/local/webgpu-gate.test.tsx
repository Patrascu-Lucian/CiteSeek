import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WebGpuGate } from "./webgpu-gate";

const detect = vi.hoisted(() => vi.fn());

vi.mock("@/lib/local/webgpu", () => ({ detectWebGpu: detect }));

// Braced: an arrow returning `mockReset()` hands the hook the mock itself, and
// the runner waits on it until it times out.
beforeEach(() => {
  detect.mockReset();
});

describe("WebGpuGate", () => {
  it("says it is checking before the probe resolves", () => {
    detect.mockReturnValue(new Promise(() => {}));

    render(
      <WebGpuGate>
        <p>local surface</p>
      </WebGpuGate>,
    );

    // Announced, not silent: the first thing local mode does is ask the machine
    // for a device, and that can take a moment on a cold GPU.
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("local surface")).not.toBeInTheDocument();
  });

  it("renders the local surface once an adapter is granted", async () => {
    detect.mockResolvedValue({ status: "available" });

    render(
      <WebGpuGate>
        <p>local surface</p>
      </WebGpuGate>,
    );

    expect(await screen.findByText("local surface")).toBeInTheDocument();
  });

  it("explains a missing API, and says cloud still works", async () => {
    detect.mockResolvedValue({ status: "unavailable", reason: "no-api" });

    render(
      <WebGpuGate>
        <p>local surface</p>
      </WebGpuGate>,
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/doesn't support WebGPU/i);
    // The fallback is the point: a dead end here would strand the reader.
    expect(alert).toHaveTextContent(/cloud mode still works/i);
    expect(screen.queryByText("local surface")).not.toBeInTheDocument();
  });

  it("distinguishes a refused adapter from a missing API", async () => {
    // Different copy because the remedies differ — one is "use another browser",
    // the other is "check a flag or your hardware".
    detect.mockResolvedValue({ status: "unavailable", reason: "no-adapter" });

    render(
      <WebGpuGate>
        <p>local surface</p>
      </WebGpuGate>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /won't provide a GPU/i,
    );
  });
});
