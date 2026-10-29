-- Documents : catégories libres (suite de migration-documents-vrac-2026-10-29.sql).
--
-- `documents.categorie` portait une contrainte CHECK qui n'acceptait que les 6
-- catégories d'origine (Identité, Véhicule, Logement, Santé, Assurance, Autre).
-- Les catégories sont désormais gérées dans `documents_categories` (créées par le
-- tri Gemini, renommées, fusionnées) : la contrainte refusait toute catégorie
-- nouvelle (« 1 document n'a pas pu être trié ») et tout renommage.
--
-- L'application valide la catégorie contre la table (voir `categorieInconnue`
-- dans src/app/actions/documents.ts). Aucune donnée n'est modifiée.
--
-- Appliquée sur la base de production le 2026-10-29 via le connecteur Supabase.

alter table documents drop constraint if exists documents_categorie_check;
