-- Appelle l'Edge Function envoyer-rappel-vidage toutes les minutes ; la fonction
-- ne pousse que si l'heure réglée (vidage_heure) est atteinte et si la feuille
-- du jour est encore vide. pg_cron, pg_net et les secrets Vault (project_url,
-- publishable_key) existent déjà (voir migration-cron-rappels-taches-2026-09-01.sql).

select cron.schedule(
  'rappel-vidage',
  '* * * * *',
  $$
  select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/envoyer-rappel-vidage',
      headers := jsonb_build_object(
        'Content-type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
      ),
      body := '{}'::jsonb
  ) as request_id;
  $$
);
