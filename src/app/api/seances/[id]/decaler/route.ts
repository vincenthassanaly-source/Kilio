import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decalerSeance } from "@/lib/seances/serveur";
import { estUuid } from "@/lib/uuid";

// Appelée depuis le bouton « Décaler » de la notification de rappel de séance
// (public/sw.js, notificationclick) : comme /api/taches/[id]/…, une route API
// classique est fetch-able directement depuis le service worker, sans passer
// par le contexte d'une page ouverte. La séance part au prochain jour libre de
// la semaine (même règle que le bouton « Décaler » de l'écran Aujourd'hui).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estUuid(id)) {
    return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
  }

  const resultat = await decalerSeance(createAdminClient(), id);
  if (resultat.error) {
    return NextResponse.json({ error: resultat.error }, { status: 409 });
  }

  revalidatePath("/aujourdhui");
  return NextResponse.json({ ok: true, date: resultat.date });
}
