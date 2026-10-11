-- Module Musculation (calqué sur Hevy) : socle de données.
--
-- • exercices : catalogue (vide au départ, alimenté plus tard par migration ou
--   import JSON). `mode_saisie` détermine les colonnes d'une série ;
--   `muscle_principal` / `muscles_secondaires` suivent la liste fixe de
--   src/lib/musculation/constantes.ts (MUSCLES).
-- • routine_dossiers / routines / routine_exercices / routine_series : modèles
--   de séances réutilisables, rangés en dossiers. Une routine porte
--   optionnellement un type LEGS / PUSH / PULL (lien avec les séances planifiées).
-- • entrainements / entrainement_exercices / entrainement_series : séances
--   réellement effectuées (toujours terminées : le brouillon d'une séance en
--   cours vit côté client, dans Dexie, jusqu'à la synchro). `seance_id` relie
--   l'entraînement à la séance planifiée (table `seances`).
--
-- Poids en kg uniquement. En mode « poids du corps », `poids_kg` est le lest
-- ajouté (négatif = assistance). Les dates sont des `text` YYYY-MM-DD, comme
-- partout ailleurs.
--
-- Même convention que les autres tables : RLS activée sans politique, seul le
-- client admin (service role) y accède.

create table public.exercices (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(btrim(nom)) between 1 and 80),
  mode_saisie text not null default 'poids_reps'
    check (mode_saisie in ('poids_reps', 'poids_corps_reps', 'duree', 'distance_duree', 'poids_duree')),
  muscle_principal text not null
    check (muscle_principal in (
      'pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'avant_bras', 'abdos',
      'quadriceps', 'ischios', 'fessiers', 'mollets', 'adducteurs', 'abducteurs',
      'trapezes', 'lombaires', 'cardio', 'corps_entier'
    )),
  muscles_secondaires text[] not null default '{}'
    check (muscles_secondaires <@ array[
      'pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'avant_bras', 'abdos',
      'quadriceps', 'ischios', 'fessiers', 'mollets', 'adducteurs', 'abducteurs',
      'trapezes', 'lombaires', 'cardio', 'corps_entier'
    ]::text[]),
  materiel text null check (materiel is null or char_length(btrim(materiel)) between 1 and 60),
  -- Repos par défaut de l'exercice, en secondes ; null = repos global.
  repos_defaut_s integer null check (repos_defaut_s is null or repos_defaut_s between 0 and 1800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index exercices_nom_unique_idx on public.exercices (lower(btrim(nom)));

alter table public.exercices enable row level security;

create trigger trg_exercices_updated_at
  before update on public.exercices
  for each row execute function public.set_updated_at();

create table public.routine_dossiers (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(btrim(nom)) between 1 and 60),
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.routine_dossiers enable row level security;

create trigger trg_routine_dossiers_updated_at
  before update on public.routine_dossiers
  for each row execute function public.set_updated_at();

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid null references public.routine_dossiers(id) on delete set null,
  nom text not null check (char_length(btrim(nom)) between 1 and 80),
  type_seance text null check (type_seance is null or type_seance in ('LEGS', 'PUSH', 'PULL')),
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index routines_dossier_idx on public.routines (dossier_id);
create index routines_type_seance_idx on public.routines (type_seance);

alter table public.routines enable row level security;

create trigger trg_routines_updated_at
  before update on public.routines
  for each row execute function public.set_updated_at();

create table public.routine_exercices (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  exercice_id uuid not null references public.exercices(id) on delete restrict,
  ordre integer not null default 0,
  -- Surcharge du repos pour cet exercice dans cette routine ; null = repos de l'exercice.
  repos_s integer null check (repos_s is null or repos_s between 0 and 1800),
  created_at timestamptz not null default now()
);

create index routine_exercices_routine_idx on public.routine_exercices (routine_id, ordre);
create index routine_exercices_exercice_idx on public.routine_exercices (exercice_id);

alter table public.routine_exercices enable row level security;

create table public.routine_series (
  id uuid primary key default gen_random_uuid(),
  routine_exercice_id uuid not null references public.routine_exercices(id) on delete cascade,
  ordre integer not null default 0,
  type_serie text not null default 'normale'
    check (type_serie in ('normale', 'echauffement', 'dropset', 'echec')),
  poids_kg numeric(6, 2) null,
  reps integer null check (reps is null or reps >= 0),
  duree_s integer null check (duree_s is null or duree_s >= 0),
  distance_m numeric(8, 1) null check (distance_m is null or distance_m >= 0),
  created_at timestamptz not null default now()
);

create index routine_series_exercice_idx on public.routine_series (routine_exercice_id, ordre);

alter table public.routine_series enable row level security;

create table public.entrainements (
  id uuid primary key default gen_random_uuid(),
  -- Séance planifiée à l'origine de l'entraînement (null = séance libre).
  seance_id uuid null references public.seances(id) on delete set null,
  routine_id uuid null references public.routines(id) on delete set null,
  titre text not null default 'Séance' check (char_length(btrim(titre)) between 1 and 80),
  date text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  debut_at timestamptz not null,
  fin_at timestamptz not null,
  duree_s integer not null check (duree_s >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fin_at >= debut_at)
);

create index entrainements_date_idx on public.entrainements (date desc);
create index entrainements_seance_idx on public.entrainements (seance_id);

alter table public.entrainements enable row level security;

create trigger trg_entrainements_updated_at
  before update on public.entrainements
  for each row execute function public.set_updated_at();

create table public.entrainement_exercices (
  id uuid primary key default gen_random_uuid(),
  entrainement_id uuid not null references public.entrainements(id) on delete cascade,
  exercice_id uuid not null references public.exercices(id) on delete restrict,
  ordre integer not null default 0,
  repos_s integer null check (repos_s is null or repos_s between 0 and 1800),
  created_at timestamptz not null default now()
);

create index entrainement_exercices_entrainement_idx on public.entrainement_exercices (entrainement_id, ordre);
create index entrainement_exercices_exercice_idx on public.entrainement_exercices (exercice_id);

alter table public.entrainement_exercices enable row level security;

create table public.entrainement_series (
  id uuid primary key default gen_random_uuid(),
  entrainement_exercice_id uuid not null references public.entrainement_exercices(id) on delete cascade,
  ordre integer not null default 0,
  type_serie text not null default 'normale'
    check (type_serie in ('normale', 'echauffement', 'dropset', 'echec')),
  poids_kg numeric(6, 2) null,
  reps integer null check (reps is null or reps >= 0),
  duree_s integer null check (duree_s is null or duree_s >= 0),
  distance_m numeric(8, 1) null check (distance_m is null or distance_m >= 0),
  created_at timestamptz not null default now()
);

create index entrainement_series_exercice_idx on public.entrainement_series (entrainement_exercice_id, ordre);

alter table public.entrainement_series enable row level security;
