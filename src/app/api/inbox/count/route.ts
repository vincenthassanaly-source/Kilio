import { connection, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Nombre de captures à trier, pour les pastilles (« + », « Plus », tuile Inbox).
// Route GET plutôt que Server Action : les Server Actions d'un client passent
// l'une après l'autre, un compteur relu à chaque page retarderait les vraies
// actions (cocher, planifier…).
export async function GET() {
  // Jamais prérendue au build : le compteur est lu à la requête.
  await connection();
  const supabase = createAdminClient();
  const { count, error } = await supabase.from("inbox_items").select("id", { count: "exact", head: true });
  if (error) return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  return NextResponse.json({ count: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
