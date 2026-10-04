import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { estUuid } from "@/lib/uuid";
import { createAdminClient } from "@/lib/supabase/admin";
import { TACHES_TAG } from "@/lib/taches/tags";

// Appelée depuis les actions de la notification push (public/sw.js,
// notificationclick) : contrairement aux Server Actions de src/app/actions,
// une route API classique est fetch-able directement depuis le service
// worker, sans passer par le contexte d'une page ouverte.
//
// Ne touche ni echeance ni heure : reporter le rappel ne déplace pas
// l'échéance réelle de la tâche, seulement la prochaine notification (cf.
// scripts/migration-rappel-taches-report-notification-2026-09-27.sql).

const DELAIS_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "1j": 24 * 60 * 60 * 1000,
  "1sem": 7 * 24 * 60 * 60 * 1000,
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estUuid(id)) {
    return NextResponse.json({ error: "Tâche introuvable." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const delai = typeof body?.delai === "string" ? DELAIS_MS[body.delai] : undefined;
  if (!delai) {
    return NextResponse.json({ error: "Délai invalide." }, { status: 400 });
  }

  const rappelReporteJusqua = new Date(Date.now() + delai).toISOString();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("taches")
    .update({ rappel_reporte_jusqua: rappelReporteJusqua })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag(TACHES_TAG, { expire: 0 });

  return NextResponse.json({ ok: true, rappelReporteJusqua });
}
