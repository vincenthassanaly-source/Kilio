-- Étape 3 du plan « tenir la diète » : pesée hebdomadaire et bilan de la semaine.
--
-- • mesures_corps : une ligne par date, avec le poids (kg) et/ou le tour de taille
--   (cm). Le tour de taille est le meilleur indicateur de la graisse abdominale ;
--   le poids est lissé sur 7 jours à l'affichage (src/lib/sante/compute.ts).
-- • reglages_briefing : push « Bilan de la semaine » (dimanche 18:00 par défaut,
--   heure de Paris), au plus un envoi par jour (bilan_dernier_envoi).
-- • Cron : l'Edge Function envoyer-bilan-hebdo est appelée chaque minute.
--
-- Même convention que les autres tables : RLS activée sans politique, seul le
-- client admin (service role) y accède.

create table public.mesures_corps (
  date text primary key check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  poids_kg numeric(5, 2) check (poids_kg is null or (poids_kg >= 30 and poids_kg <= 300)),
  tour_taille_cm numeric(5, 1) check (tour_taille_cm is null or (tour_taille_cm >= 40 and tour_taille_cm <= 250)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mesures_corps_une_valeur check (poids_kg is not null or tour_taille_cm is not null)
);

alter table public.mesures_corps enable row level security;

create trigger trg_mesures_corps_updated_at
  before update on public.mesures_corps
  for each row execute function public.set_updated_at();

alter table public.reglages_briefing
  add column if not exists bilan_actif boolean not null default true,
  add column if not exists bilan_jour smallint not null default 0,
  add column if not exists bilan_heure time not null default '18:00',
  add column if not exists bilan_dernier_envoi date;

alter table public.reglages_briefing
  drop constraint if exists reglages_briefing_bilan_jour_check,
  add constraint reglages_briefing_bilan_jour_check check (bilan_jour between 0 and 6);

-- Secrets Vault project_url et publishable_key déjà en place
-- (migration-cron-rappels-taches-2026-09-01.sql).
select cron.schedule(
  'bilan-hebdo',
  '* * * * *',
  $$
  select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/envoyer-bilan-hebdo',
      headers := jsonb_build_object(
        'Content-type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
      ),
      body := '{}'::jsonb
  ) as request_id;
  $$
);
