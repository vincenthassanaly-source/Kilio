import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { AppResumeRefresh } from "./AppResumeRefresh";

function changerVisibilite(etat: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: etat });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("AppResumeRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
    refresh.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("ne rafraîchit pas après une absence courte", () => {
    render(<AppResumeRefresh />);
    changerVisibilite("hidden");
    vi.setSystemTime(new Date("2026-10-26T10:00:10Z"));
    changerVisibilite("visible");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rafraîchit après une absence longue", () => {
    render(<AppResumeRefresh />);
    changerVisibilite("hidden");
    vi.setSystemTime(new Date("2026-10-26T10:02:00Z"));
    changerVisibilite("visible");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("rafraîchit quand l'app n'a pas été vue partir", () => {
    render(<AppResumeRefresh />);
    changerVisibilite("visible");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
