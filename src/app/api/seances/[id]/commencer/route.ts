import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { commencerSeance } from "@/lib/seances/serveur";
import { estUuid } from "@/lib/uuid";

// Appelée depuis le bouton « Commencer » de la notification de rappel de séance
// (public/sw.js, notificationclick) : comme /decaler, une route API classique
// fetch-able depuis le service worker. Elle coche la séance comme faite (même
// effet que la coche de l'écran Aujourd'hui). Séance introuvable ou déjà faite :
// 409, le service worker ouvre alors l'app pour montrer l'état réel.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estUuid(id)) {
    return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
  }

  const resultat = await commencerSeance(createAdminClient(), id);
  if (resultat.error) {
    return NextResponse.json({ error: resultat.error }, { status: 409 });
  }

  revalidatePath("/aujourdhui");
  revalidatePath("/nutrition/journal");
  revalidatePath("/nutrition/bilan");
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
