-- Active RLS (deny-all, sans policy) sur les deux tables restées exposées à la
-- clé publique après migration-enable-rls-deny-all-2026-09-11.sql : journal_jours
-- (type de jour repos / entraînement) et objectif_habitudes (liens objectif ↔
-- habitude). Convention Kilio : le service_role des Server Actions
-- (src/lib/supabase/admin.ts) bypass RLS, et aucun code n'utilise la clé
-- publique, donc rien ne change côté app.

ALTER TABLE "public"."journal_jours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."objectif_habitudes" ENABLE ROW LEVEL SECURITY;
