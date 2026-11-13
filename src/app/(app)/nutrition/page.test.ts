import { describe, expect, it, vi } from "vitest";

// Le Carnet lit Supabase côté serveur ; seul l'identité de la page compte ici.
vi.mock("next/server", () => ({ connection: vi.fn(), NextResponse: {} }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import NutritionPage from "./page";
import JournalPage from "./journal/page";

describe("/nutrition", () => {
  it("sert directement le Carnet alimentaire (plus d'écran-hub devant lui)", () => {
    expect(NutritionPage).toBe(JournalPage);
  });
});
