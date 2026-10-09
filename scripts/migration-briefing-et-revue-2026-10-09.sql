-- Briefing du matin : notification push quotidienne (événements, tâches du
-- jour, retards). Appliqué sur le projet Supabase « kilio » via MCP le
-- 2026-10-09, en 3 temps : table (migration `reglages_briefing`), déploiement
-- de l'Edge Function envoyer-briefing-matin, puis planification ci-dessous.
-- Singleton sur le modèle de reglages_nettoyage. L'heure est celle de Paris ;
-- la fonction tolère 3 h de retard (cron manqué) et n'envoie qu'une fois par jour.
create table public.reglages_briefing (
  id smallint primary key default 1,
  actif boolean not null default true,
  heure time not null default '07:30',
  dernier_envoi date null,
  updated_at timestamptz not null default now(),
  constraint reglages_briefing_singleton check (id = 1)
);

alter table public.reglages_briefing enable row level security;

create trigger trg_reglages_briefing_updated_at
  before update on public.reglages_briefing
  for each row execute function public.set_updated_at();

insert into public.reglages_briefing (id, actif, heure) values (1, true, '07:30');

-- Secrets Vault project_url et publishable_key déjà en place
-- (migration-cron-rappels-taches-2026-09-01.sql).
select cron.schedule(
  'briefing-matin',
  '* * * * *',
  $$
  select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/envoyer-briefing-matin',
      headers := jsonb_build_object(
        'Content-type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
      ),
      body := '{}'::jsonb
  ) as request_id;
  $$
);

-- ---------------------------------------------------------------------------
-- Revue hebdomadaire (étape 5) : mêmes réglages, colonnes ajoutées à la table.
-- Appliquée via MCP (`reglages_briefing_revue_hebdo`), puis Edge Function
-- envoyer-revue-hebdo déployée, puis cron ci-dessous. 0 = dimanche (getDay).
alter table public.reglages_briefing
  add column if not exists revue_actif boolean not null default true,
  add column if not exists revue_jour smallint not null default 0,
  add column if not exists revue_heure time not null default '18:00',
  add column if not exists revue_dernier_envoi date;

alter table public.reglages_briefing
  drop constraint if exists reglages_briefing_revue_jour_check,
  add constraint reglages_briefing_revue_jour_check check (revue_jour between 0 and 6);

select cron.schedule(
  'revue-hebdo',
  '* * * * *',
  $$
  select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/envoyer-revue-hebdo',
      headers := jsonb_build_object(
        'Content-type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
      ),
      body := '{}'::jsonb
  ) as request_id;
  $$
);
