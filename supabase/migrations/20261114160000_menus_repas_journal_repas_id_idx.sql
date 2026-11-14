-- Index de la FK menus_repas.journal_repas_id (filtrée par app/actions/journal.ts
-- et utile aux suppressions en cascade côté journal_repas). Appliqué en prod via
-- CREATE INDEX CONCURRENTLY ; ce fichier reflète l'état de la base.
-- À exécuter hors transaction : CONCURRENTLY n'est pas permis dans un bloc BEGIN.
CREATE INDEX CONCURRENTLY IF NOT EXISTS menus_repas_journal_repas_id_idx
  ON public.menus_repas (journal_repas_id);
