-- Suppression du module Budget.
--
-- À lancer APRÈS le déploiement du code qui ne lit plus ces tables
-- (sinon l'app interrogerait des tables disparues). IRRÉVERSIBLE : aucune
-- sauvegarde n'est faite (au 2026-10-05 : 117 transactions, 2 comptes,
-- 12 catégories, 0 budget, 0 récurrence).
--
-- `frequence_recurrence` est CONSERVÉ : taches.recurrence_frequence l'utilise.
-- Aucune autre table ni fonction ne référence ces tables (vérifié via
-- pg_constraint / pg_proc) ; CASCADE retire leurs index, triggers et policies.

begin;

drop table if exists public.transactions cascade;
drop table if exists public.transactions_recurrentes cascade;
drop table if exists public.budgets cascade;
drop table if exists public.categories_budget cascade;
drop table if exists public.comptes cascade;

drop type if exists public.type_mouvement;
drop type if exists public.type_compte;
drop type if exists public.type_periode_budget;

-- Préférences de navigation : retire /budget de la grille Plus et de la
-- barre du bas (le code ignore de toute façon les href inconnus).
update public.preferences_navigation
set ordre_grille_plus = array_remove(ordre_grille_plus, '/budget'),
    modules_barre_basse = array_remove(modules_barre_basse, '/budget')
where '/budget' = any(ordre_grille_plus) or '/budget' = any(modules_barre_basse);

commit;
