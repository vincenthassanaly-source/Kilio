-- Module Sport, PR 2 : routines, séances et séries.
--
-- Convention Kilio : pas de user_id, RLS activé SANS policy (deny-all) — le
-- service_role des Server Actions bypass RLS.
--
-- Les identifiants des séances et des séries sont générés CÔTÉ CLIENT (uuid) :
-- une séance terminée hors ligne est renvoyée telle quelle à la reconnexion
-- (upsert), sans créer de doublon si le premier envoi avait en fait abouti.

CREATE TABLE IF NOT EXISTS public.sport_routines (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        text NOT NULL CHECK (char_length(btrim(nom)) BETWEEN 1 AND 80),
  ordre      integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sport_routine_exercices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id  uuid NOT NULL REFERENCES public.sport_routines (id) ON DELETE CASCADE,
  exercice_id text NOT NULL REFERENCES public.sport_exercices (id),
  position    integer NOT NULL,
  nb_series   integer NOT NULL DEFAULT 3 CHECK (nb_series BETWEEN 1 AND 20),
  reps_cible  integer CHECK (reps_cible BETWEEN 1 AND 200),
  repos_s     integer NOT NULL DEFAULT 90 CHECK (repos_s BETWEEN 0 AND 1800)
);

CREATE INDEX IF NOT EXISTS sport_routine_exercices_routine_idx
  ON public.sport_routine_exercices (routine_id, position);

CREATE TABLE IF NOT EXISTS public.sport_seances (
  id         uuid PRIMARY KEY,
  routine_id uuid REFERENCES public.sport_routines (id) ON DELETE SET NULL,
  nom        text NOT NULL CHECK (char_length(btrim(nom)) BETWEEN 1 AND 80),
  debut_at   timestamptz NOT NULL,
  fin_at     timestamptz NOT NULL,
  -- Jour calendaire Europe/Paris du début de séance.
  jour       date NOT NULL,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fin_at >= debut_at)
);

CREATE INDEX IF NOT EXISTS sport_seances_debut_idx ON public.sport_seances (debut_at DESC);

CREATE TABLE IF NOT EXISTS public.sport_series (
  id           uuid PRIMARY KEY,
  seance_id    uuid NOT NULL REFERENCES public.sport_seances (id) ON DELETE CASCADE,
  exercice_id  text NOT NULL REFERENCES public.sport_exercices (id),
  -- Rang de l'exercice dans la séance, puis rang de la série dans l'exercice.
  position     integer NOT NULL,
  ordre        integer NOT NULL,
  poids_kg     numeric(6, 2) CHECK (poids_kg BETWEEN 0 AND 1000),
  reps         integer CHECK (reps BETWEEN 0 AND 1000),
  duree_s      integer CHECK (duree_s BETWEEN 0 AND 86400),
  -- Repos réellement pris APRÈS cette série (jusqu'à la série suivante du même exercice).
  repos_pris_s integer CHECK (repos_pris_s BETWEEN 0 AND 7200),
  fait_at      timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sport_series_seance_idx ON public.sport_series (seance_id, position, ordre);
CREATE INDEX IF NOT EXISTS sport_series_exercice_idx ON public.sport_series (exercice_id, fait_at DESC);

ALTER TABLE public.sport_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sport_routine_exercices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sport_seances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sport_series ENABLE ROW LEVEL SECURITY;
