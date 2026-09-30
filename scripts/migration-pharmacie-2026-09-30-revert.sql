-- Retour arrière de migration-pharmacie-2026-09-30.sql.
-- Supprime le module Pharmacie et TOUTES ses données (matières, chapitres,
-- notions, cartes, historique). Les extensions unaccent et pg_trgm sont
-- conservées (potentiellement utilisées ailleurs).

drop function if exists public.pharma_rechercher(text);
drop table if exists public.pharma_historique;
drop table if exists public.pharma_cartes;
drop table if exists public.pharma_notions;
drop table if exists public.pharma_chapitres;
drop table if exists public.pharma_matieres;
