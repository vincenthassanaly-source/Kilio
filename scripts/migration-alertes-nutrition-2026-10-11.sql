-- Étape 2 du plan « tenir la diète » : jours libres (jetons) et alertes push.
--
-- • jours_libres : un jour libre suspend la limite kcal de la date (pas
--   d'alerte, jour neutre dans le Bilan). 2 jetons par semaine (lundi → dimanche),
--   posés le jour même ou la veille : la règle est appliquée par l'app
--   (src/lib/nutrition/libres.ts), la table ne stocke que les dates.
-- • reglages_briefing : alerte à l'approche de la limite kcal (85 %) et rappel
--   de saisie quand le journal est vide en fin de journée (20:00 par défaut),
--   chacun envoyé au plus une fois par jour (colonnes *_dernier_envoi).
-- • Cron : l'Edge Function envoyer-alertes-nutrition est appelée chaque minute.
--   Les repas sont souvent ajoutés directement en base (via Claude), sans passer
--   par une Server Action de l'app : seule une lecture périodique les voit tous.
--
-- Même convention que les autres tables : RLS activée sans politique, seul le
-- client admin (service role) y accède.

create table public.jours_libres (
  date text primary key check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  created_at timestamptz not null default now()
);

alter table public.jours_libres enable row level security;

alter table public.reglages_briefing
  add column if not exists alerte_kcal_actif boolean not null default true,
  add column if not exists alerte_kcal_dernier_envoi date,
  add column if not exists rappel_saisie_actif boolean not null default true,
  add column if not exists rappel_saisie_heure time not null default '20:00',
  add column if not exists rappel_saisie_dernier_envoi date;

-- Secrets Vault project_url et publishable_key déjà en place
-- (migration-cron-rappels-taches-2026-09-01.sql).
select cron.schedule(
  'alertes-nutrition',
  '* * * * *',
  $$
  select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/envoyer-alertes-nutrition',
      headers := jsonb_build_object(
        'Content-type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
      ),
      body := '{}'::jsonb
  ) as request_id;
  $$
);
