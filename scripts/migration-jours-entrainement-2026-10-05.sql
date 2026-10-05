-- Statut d'entraînement par date : remplace le planning hebdomadaire
-- (nutrition_planning). Une ligne par date où l'utilisateur a basculé le
-- statut ; sans ligne, la journée est un jour de repos. Les jours passés
-- repartent de zéro (le planning n'est pas converti).

create table if not exists jours_entrainement (
  date text primary key check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  entraine boolean not null default true,
  updated_at timestamptz not null default now()
);

drop table if exists nutrition_planning;
