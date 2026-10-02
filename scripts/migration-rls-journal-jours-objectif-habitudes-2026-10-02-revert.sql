-- Revert de migration-rls-journal-jours-objectif-habitudes-2026-10-02.sql :
-- rouvre ces deux tables à l'accès direct avec la clé publique.

ALTER TABLE "public"."journal_jours" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."objectif_habitudes" DISABLE ROW LEVEL SECURITY;
