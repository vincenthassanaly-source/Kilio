import { NextResponse, type NextRequest } from "next/server";
import { annulerRappelRepos, programmerRappelRepos } from "@/app/actions/rappel-repos";

// Programme (POST) ou annule (DELETE) le push de fin de repos. Même logique que les
// Server Actions de actions/rappel-repos.ts, mais en route API : le client l'appelle avec
// `fetch(..., { keepalive: true })`, seule façon de faire partir la requête quand le
// téléphone se verrouille juste après la validation d'une série (une Server Action,
// elle, est abandonnée avec la page passée en arrière-plan).

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (typeof body?.finA !== "string" || typeof body?.titre !== "string" || typeof body?.corps !== "string") {
    return NextResponse.json({ error: "Rappel invalide." }, { status: 400 });
  }
  const resultat = await programmerRappelRepos({ finA: body.finA, titre: body.titre, corps: body.corps });
  return resultat.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: resultat.error }, { status: 400 });
}

export async function DELETE() {
  const resultat = await annulerRappelRepos();
  return resultat.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: resultat.error }, { status: 500 });
}
