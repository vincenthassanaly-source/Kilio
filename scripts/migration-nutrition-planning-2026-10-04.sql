-- Planning hebdomadaire d'entraînement (Journal Nutrition) : remplace la
-- bascule Repos / Entraînement mémorisée par date (journal_jours). Les jours
-- cochés ont la cible « entraînement » d'objectifs_nutritionnels, tous les
-- autres la cible « repos ».
--
-- Ligne unique (id = 1, app mono-utilisateur) ; jours numérotés comme en ISO
-- 8601 : 1 = lundi … 7 = dimanche. Aucune ligne ou liste vide = repos tous les
-- jours. Schéma plat, sans user_id (conventions Kilio) ; RLS deny-all sans
-- policy : le service_role des Server Actions la contourne.
-- set_updated_at() existe déjà (migration-aliments-2026-08-27.sql).

create table if not exists nutrition_planning (
  id smallint primary key default 1 check (id = 1),
  jours_entrainement smallint[] not null default '{}'
    check (jours_entrainement <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  updated_at timestamptz not null default now()
);

drop trigger if exists nutrition_planning_set_updated_at on nutrition_planning;
create trigger nutrition_planning_set_updated_at
  before update on nutrition_planning
  for each row execute function set_updated_at();

alter table nutrition_planning enable row level security;
