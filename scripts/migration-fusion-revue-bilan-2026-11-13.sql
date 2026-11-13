-- Fusion de la notification « Bilan de la semaine » dans la revue hebdomadaire.
--
-- Une seule notification par semaine : la revue (Edge Function
-- envoyer-revue-hebdo, colonnes revue_*) porte désormais aussi les quatre lignes
-- santé du bilan (kcal moyens, séances, poids lissé, tour de taille). Le push
-- « Bilan de la semaine » (migration-bilan-sante-2026-10-11.sql) disparaît :
-- on retire son cron et ses colonnes de réglage. La page /nutrition/bilan et la
-- table mesures_corps restent.
--
-- À EXÉCUTER dans cet ordre, APRÈS le déploiement de la nouvelle version de
-- envoyer-revue-hebdo (qui n'a plus besoin des colonnes bilan_*) :
--   1. arrêter le cron, pour que plus aucun appel ne parte vers la fonction ;
--   2. supprimer la fonction déployée envoyer-bilan-hebdo (hors SQL, voir ci-dessous) ;
--   3. retirer les colonnes de réglage devenues inutiles.
-- Idempotent : peut être rejoué sans erreur.

-- 1. Cron : sans effet si la tâche n'existe plus (convention du dépôt, cf.
--    migration-ppl-semaine-suppression-2026-10-12.sql).
select cron.unschedule(jobid) from cron.job where jobname = 'bilan-hebdo';

-- 2. HORS SQL : supprimer l'Edge Function déployée envoyer-bilan-hebdo
--    (tableau de bord Supabase > Edge Functions, ou `supabase functions delete
--    envoyer-bilan-hebdo`). Son code a été retiré du dépôt.

-- 3. Colonnes de réglage du bilan (la contrainte check disparaît avec bilan_jour,
--    mais on la retire explicitement pour rester lisible et rejouable).
alter table public.reglages_briefing
  drop constraint if exists reglages_briefing_bilan_jour_check;

alter table public.reglages_briefing
  drop column if exists bilan_actif,
  drop column if exists bilan_jour,
  drop column if exists bilan_heure,
  drop column if exists bilan_dernier_envoi;
