-- Vide toutes les données du module Pharmacie (schéma conservé).
-- Irréversible : aucune sauvegarde. À exécuter dans l'éditeur SQL Supabase.
begin;
delete from public.pharma_ref_ligne_items;
delete from public.pharma_ref_lignes;
delete from public.pharma_ref_pathologies;
delete from public.pharma_ref_specialites;
delete from public.pharma_ref_molecules;
delete from public.pharma_ref_classes;
delete from public.pharma_cartes;
delete from public.pharma_notions;
delete from public.pharma_chapitres;
delete from public.pharma_matieres;
delete from public.pharma_historique;
commit;
