-- Documents : suppression des étiquettes, de l'échéance et du « mois concerné ».
--
-- Le module Documents ne garde que des catégories (table documents_categories).
-- Ce script retire ce que le code n'utilise plus. IRRÉVERSIBLE : à appliquer
-- seulement APRÈS le déploiement du code qui ne les lit plus, sinon la page
-- Documents échouerait (son ancienne requête joignait `etiquettes`).
--
-- Perdu : les 27 étiquettes (liste préremplie) et le lien de 2 documents avec
-- leur étiquette ; les colonnes d'échéance, de mois concerné et de suivi
-- d'alerte (toutes vides pour les 7 documents existants). Les documents, leurs
-- fichiers, leurs catégories et leurs notes ne sont pas touchés.
--
-- 1. Rappels d'échéance : la tâche planifiée quotidienne (6 h) qui appelait la
--    fonction Edge `envoyer-rappels-documents` (supprimée du dépôt). La fonction
--    déployée, plus appelée par rien, se supprime depuis le tableau de bord
--    Supabase (Edge Functions) ou avec `supabase functions delete`.
-- 2. Colonnes de `documents` ; leurs index (idx_documents_etiquette_id,
--    idx_documents_date_echeance) et la clé étrangère partent avec elles.
-- 3. Table `etiquettes` (son déclencheur et ses index partent avec elle).

select cron.unschedule(jobid) from cron.job where jobname = 'rappels-documents';

alter table documents
  drop column if exists etiquette_id,
  drop column if exists date_echeance,
  drop column if exists periode_mois,
  drop column if exists derniere_alerte_envoyee_le;

drop table if exists etiquettes;
