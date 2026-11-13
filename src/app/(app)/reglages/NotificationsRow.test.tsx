import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationsRow } from "./NotificationsRow";
import { BandeauNotificationsEteintes, NotificationsProvider } from "./NotificationsContext";

vi.mock("@/lib/push/subscribe", () => ({
  isPushSupported: vi.fn(() => true),
  getExistingSubscription: vi.fn(async () => null),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}));
import { subscribeToPush } from "@/lib/push/subscribe";

function definirPermission(valeur: NotificationPermission) {
  vi.stubGlobal("Notification", { permission: valeur });
}

beforeEach(() => {
  vi.clearAllMocks();
  definirPermission("default");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("NotificationsRow", () => {
  it("n'affiche jamais le détail technique d'une erreur d'activation", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(subscribeToPush).mockRejectedValue(new Error("Clé VAPID publique manquante (NEXT_PUBLIC_VAPID_PUBLIC_KEY)."));
    render(<NotificationsRow />);
    const bascule = screen.getByRole("switch", { name: "Activer les notifications" });
    await waitFor(() => expect((bascule as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(bascule);
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toBe("Impossible d'activer les notifications pour le moment. Réessaie dans un instant.");
    expect(alerte.textContent).not.toMatch(/VAPID|NEXT_PUBLIC/);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("permission refusée : explique comment les autoriser", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    definirPermission("denied");
    vi.mocked(subscribeToPush).mockRejectedValue(new Error("Permission de notification refusée."));
    render(<NotificationsRow />);
    const bascule = screen.getByRole("switch", { name: "Activer les notifications" });
    await waitFor(() => expect((bascule as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(bascule);
    expect((await screen.findByRole("alert")).textContent).toMatch(/bloquées pour ce site/);
    consoleError.mockRestore();
  });

  it("éteintes, elles font apparaître le bandeau « Active d'abord les notifications »", async () => {
    render(
      <NotificationsProvider>
        <NotificationsRow />
        <BandeauNotificationsEteintes />
      </NotificationsProvider>
    );
    expect((await screen.findByRole("status")).textContent).toMatch(/Active d'abord les notifications/);
  });
});
