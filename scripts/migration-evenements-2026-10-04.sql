-- Événements légers de l'agenda : un rendez-vous avec titre, date, heure et
-- durée, sans case à cocher (≠ une tâche). Affichés dans l'écran « Aujourd'hui »
-- et dans l'agenda. L'heure de fin est stockée (heure + durée choisie au
-- formulaire) pour rester compatible avec la mise en page de la grille horaire.
--
-- Même modèle d'accès que les autres tables : RLS activée sans politique,
-- lecture et écriture par le client service role côté serveur uniquement.
create table if not exists evenements (
  id uuid primary key default gen_random_uuid(),
  titre text not null check (length(btrim(titre)) > 0),
  date date not null,
  heure time not null,
  heure_fin time not null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (heure_fin > heure)
);

create index if not exists evenements_date_heure_idx on evenements (date, heure);

alter table evenements enable row level security;
