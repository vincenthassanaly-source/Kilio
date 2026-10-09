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
