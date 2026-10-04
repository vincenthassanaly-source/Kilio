import { NextResponse, type NextRequest } from "next/server";
import { estUuid } from "@/lib/uuid";
import { setTacheFait } from "@/app/actions/taches";

// Appelée depuis l'action "✓ Fait" de la notification push (public/sw.js,
// notificationclick) : une route API classique, fetch-able directement
// depuis le service worker sans le contexte d'une page ouverte (cf.
// reporter-rappel/route.ts, même contrainte).
//
// Délègue à setTacheFait (src/app/actions/taches.ts) pour appliquer la même
// logique de récurrence que la coche dans l'app (une tâche récurrente
// repart non cochée sur l'échéance suivante, elle ne reste pas "faite").

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estUuid(id)) {
    return NextResponse.json({ error: "Tâche introuvable." }, { status: 404 });
  }

  try {
    await setTacheFait(id, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
