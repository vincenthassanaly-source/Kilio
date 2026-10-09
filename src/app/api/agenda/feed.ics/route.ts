import { connection, NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aujourdhuiParis } from "@/lib/date/paris";
import { construireCalendrierIcs, fenetreFlux, jetonValide } from "@/lib/agenda/ics";

// Flux ICS en lecture seule de l'agenda (rendez-vous + tâches à échéance),
// pour s'abonner depuis Google Agenda / Etar et afficher leur widget Android.
// Les clients d'abonnement ne savent pas envoyer d'en-tête : le jeton secret
// (variable d'environnement AGENDA_FEED_TOKEN) est donc passé en `?token=`.
// Sans variable définie, la route est désactivée (404) ; changer la variable
// révoque l'ancienne URL. Les tâches récurrentes n'ont qu'une échéance active
// (la prochaine) : une seule occurrence apparaît.

// Code Postgres / PostgREST « table absente », comme dans actions/evenements.ts.
const CODES_TABLE_ABSENTE = ["42P01", "PGRST205"];

export async function GET(request: NextRequest) {
  // Jamais prérendue au build (la variable et la base ne sont lues qu'à la requête).
  await connection();
  const attendu = process.env.AGENDA_FEED_TOKEN;
  if (!attendu) return new NextResponse("Not found", { status: 404 });
  if (!jetonValide(request.nextUrl.searchParams.get("token"), attendu)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { debut, fin } = fenetreFlux(aujourdhuiParis());
  const supabase = createAdminClient();

  const [evenements, taches] = await Promise.all([
    // Séries : envoyées une fois (RRULE), dès qu'elles ont commencé et ne sont pas terminées.
    supabase
      .from("evenements")
      .select("id,titre,date,heure,heure_fin,notes,updated_at,toute_la_journee,recurrence_frequence,recurrence_fin")
      .or(
        `and(recurrence_frequence.is.null,date.gte.${debut},date.lte.${fin}),and(recurrence_frequence.not.is.null,date.lte.${fin},or(recurrence_fin.is.null,recurrence_fin.gte.${debut}))`
      ),
    supabase
      .from("taches")
      .select("id,titre,echeance,heure,heure_fin,duree_minutes,toute_la_journee,fait,notes,updated_at")
      .eq("fait", false)
      .gte("echeance", debut)
      .lte("echeance", fin),
  ]);

  if (evenements.error && !(evenements.error.code && CODES_TABLE_ABSENTE.includes(evenements.error.code))) {
    return new NextResponse("Erreur serveur", { status: 500 });
  }
  if (taches.error) return new NextResponse("Erreur serveur", { status: 500 });

  const ics = construireCalendrierIcs(evenements.data ?? [], taches.data ?? []);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="kilio.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
