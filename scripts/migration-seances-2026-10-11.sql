-- Séances de sport planifiées : créneaux hebdomadaires récurrents + occurrences
-- datées, avec rappel push à l'heure du créneau (Commencer / Décaler).
--
-- • creneaux_seance : le plan type de la semaine (ex. mardi 18:00 « Renfo »).
--   jour_semaine : 0 = dimanche … 6 = samedi (comme Date#getDay et revue_jour).
-- • seances : une occurrence par créneau et par semaine, créée à la demande
--   (à l'ouverture de l'écran Aujourd'hui, ou par l'Edge Function de rappel le
--   jour même). `date_prevue` est la date du créneau, `date` la date réelle
--   après un report (identiques tant que la séance n'a pas bougé).
-- • reglages_briefing.seances_rappel_actif : interrupteur du rappel push.
--
-- Même convention que les autres tables : RLS activée sans politique, seul le
-- client admin (service role) y accède.

create table public.creneaux_seance (
  id uuid primary key default gen_random_uuid(),
  jour_semaine smallint not null check (jour_semaine between 0 and 6),
  heure time not null default '18:00',
  type text not null check (char_length(btrim(type)) between 1 and 40),
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.creneaux_seance enable row level security;

create table public.seances (
  id uuid primary key default gen_random_uuid(),
  creneau_id uuid references public.creneaux_seance(id) on delete set null,
  date_prevue text not null check (date_prevue ~ '^\d{4}-\d{2}-\d{2}$'),
  date text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  heure time not null,
  type text not null,
  statut text not null default 'prevue' check (statut in ('prevue', 'faite')),
  -- true dès que la séance a quitté son jour d'origine (report manuel ou
  -- automatique) : une séance n'est replacée automatiquement qu'une fois.
  reportee boolean not null default false,
  rappel_envoye_le timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creneau_id, date_prevue)
);

create index seances_date_idx on public.seances (date);

alter table public.seances enable row level security;

create trigger trg_seances_updated_at
  before update on public.seances
  for each row execute function public.set_updated_at();

alter table public.reglages_briefing
  add column if not exists seances_rappel_actif boolean not null default true;

-- Rappel de séance : l'Edge Function envoyer-rappels-seances est appelée
-- toutes les minutes (secrets Vault project_url et publishable_key déjà en
-- place, cf. migration-cron-rappels-taches-2026-09-01.sql).
select cron.schedule(
  'rappels-seances',
  '* * * * *',
  $$
  select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/envoyer-rappels-seances',
      headers := jsonb_build_object(
        'Content-type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
      ),
      body := '{}'::jsonb
  ) as request_id;
  $$
);
