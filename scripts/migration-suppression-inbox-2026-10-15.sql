-- Suppression du module Inbox (captures rapides).
--
-- À lancer APRÈS le déploiement du code qui ne lit plus `inbox_items`
-- (sinon l'app interrogerait une table disparue). IRRÉVERSIBLE : aucune
-- sauvegarde n'est faite (au 2026-10-15 : 0 capture).
--
-- `taches.note_id` est CONSERVÉ : le lien tâche → note sert aussi aux notes.

begin;

drop table if exists public.inbox_items cascade;

-- Préférences de navigation : retire /inbox de la grille Plus et de la
-- barre du bas (le code ignore de toute façon les href inconnus).
update public.preferences_navigation
set ordre_grille_plus = array_remove(ordre_grille_plus, '/inbox'),
    modules_barre_basse = array_remove(modules_barre_basse, '/inbox')
where '/inbox' = any(ordre_grille_plus) or '/inbox' = any(modules_barre_basse);

commit;
