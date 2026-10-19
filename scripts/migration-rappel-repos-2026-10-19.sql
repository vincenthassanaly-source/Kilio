-- Notification push à la fin du repos de la séance de musculation (téléphone
-- verrouillé ou autre appli au premier plan).
--
-- Une seule ligne (`id = 'courant'`) : app mono-utilisateur, une séance en direct
-- à la fois. Le client la remplace à chaque repos (server action
-- programmerRappelRepos) et la supprime quand le repos est passé ou terminé.
--
-- Le job pg_cron tourne toutes les 5 s mais ne fait qu'un SELECT sur une table
-- minuscule : il n'appelle l'Edge Function envoyer-rappel-repos que lorsqu'un
-- rappel arrive à échéance dans les 6 s. La fonction attend alors l'échéance
-- exacte avant d'envoyer, d'où une notification à la seconde près.
--
-- pg_cron, pg_net et les secrets Vault (project_url, publishable_key) existent
-- déjà (voir migration-cron-rappels-taches-2026-09-01.sql).
-- Déployer aussi l'Edge Function : supabase functions deploy envoyer-rappel-repos
-- (mêmes secrets VAPID que envoyer-rappels-taches).

create table if not exists public.rappels_repos (
  id text primary key default 'courant',
  fin_a timestamptz not null,
  titre text not null default 'Repos terminé',
  corps text not null default '',
  url text not null default '/musculation/seance',
  envoye boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Accès uniquement via la clé service (server actions, Edge Function), comme les autres tables.
alter table public.rappels_repos enable row level security;

select cron.schedule(
  'rappel-repos',
  '5 seconds',
  $$
  select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/envoyer-rappel-repos',
      headers := jsonb_build_object(
        'Content-type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
      ),
      body := '{}'::jsonb
  ) as request_id
  where exists (
    select 1 from public.rappels_repos
    where not envoye and fin_a <= now() + interval '6 seconds'
  );
  $$
);

-- Un job toutes les 5 s écrit ~17 000 lignes par jour dans l'historique de pg_cron : on le purge.
select cron.schedule(
  'purge-historique-cron',
  '15 4 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '2 days'; $$
);
