import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { JourNavigation } from "./JournalNavigationJour";

describe("JourNavigation", () => {
  afterEach(cleanup);

  it("propose « Aujourd'hui » hors du jour courant", () => {
    render(<JourNavigation jour={{ date: "2026-11-09", depuisBilan: false, aujourdhui: "2026-11-12" }} />);
    expect(screen.getByRole("link", { name: "Aujourd'hui" })).toHaveAttribute("href", "/nutrition/journal?date=2026-11-12");
  });

  it("n'affiche pas « Aujourd'hui » le jour courant", () => {
    render(<JourNavigation jour={{ date: "2026-11-12", depuisBilan: false, aujourdhui: "2026-11-12" }} />);
    expect(screen.queryByRole("link", { name: "Aujourd'hui" })).toBeNull();
  });
});
