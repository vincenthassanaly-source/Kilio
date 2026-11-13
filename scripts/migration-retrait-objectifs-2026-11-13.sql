-- Retrait du module Objectifs (décision du 2026-11-13, audit de l'application).
--
-- Le module n'a jamais reçu une seule ligne : objectifs, objectif_etapes,
-- objectif_entries et objectif_habitudes sont vides. Le code qui les lisait est
-- retiré (PR « Audit lot 2 »). La structure est archivée dans
-- scripts/archive-objectifs-ddl-2026-11-13.sql.
--
-- NE TOUCHE PAS à objectifs_nutritionnels (cibles kcal) ni à la fonction
-- set_termine_le(), partagée par d'autres tables.
--
-- À EXÉCUTER APRÈS le redéploiement de l'Edge Function nettoyage-auto sans
-- objectif_etapes (fait). Idempotent : peut être rejoué sans erreur.

-- 1. Tables, enfants d'abord. Les index, contraintes et triggers partent avec.
drop table if exists public.objectif_habitudes;
drop table if exists public.objectif_entries;
drop table if exists public.objectif_etapes;
drop table if exists public.objectifs;

-- 2. Types devenus inutiles (seule la table objectifs les utilisait).
drop type if exists public.type_suivi_objectif;
drop type if exists public.statut_objectif;
drop type if exists public.categorie_objectif;

-- 3. La grille « Plus » enregistrée en base contient encore /objectifs.
update public.preferences_navigation
set ordre_grille_plus = array_remove(ordre_grille_plus, '/objectifs')
where id = 1;
