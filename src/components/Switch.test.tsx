import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Switch } from "./Switch";

afterEach(cleanup);

describe("Switch", () => {
  it("expose le rôle switch et son état", () => {
    render(<Switch checked label="Notifications" onToggle={() => {}} />);
    expect(screen.getByRole("switch", { name: "Notifications" })).toHaveAttribute("aria-checked", "true");
  });

  it("appelle onToggle au clic", () => {
    const onToggle = vi.fn();
    render(<Switch checked={false} label="Notifications" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("ne réagit pas quand il est désactivé", () => {
    const onToggle = vi.fn();
    render(<Switch checked={false} disabled label="Notifications" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
