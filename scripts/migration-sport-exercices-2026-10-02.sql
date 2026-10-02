-- Module Sport, PR 1 : bibliothèque d'exercices (données statiques issues de
-- free-exercise-db, domaine public / Unlicense) + bucket public des images.
--
-- Convention Kilio : pas de user_id, RLS activé SANS policy (deny-all) — le
-- service_role des Server Actions bypass RLS. Le bucket est public en lecture
-- (images d'exercices non sensibles) ; l'écriture exige le service_role.
-- Les identifiants sont les slugs de free-exercise-db (ex. "Barbell_Bench_Press_-_Medium"),
-- stables, ce qui permet de rejouer l'import (upsert) sans doublon.

CREATE TABLE IF NOT EXISTS public.sport_exercices (
  id                  text PRIMARY KEY,
  nom_fr              text NOT NULL,
  nom_en              text NOT NULL,
  muscle_principal    text NOT NULL,
  muscles_secondaires text[] NOT NULL DEFAULT '{}',
  equipement          text,
  categorie           text NOT NULL,
  niveau              text,
  mecanique           text,
  type_mesure         text NOT NULL DEFAULT 'poids_reps'
    CHECK (type_mesure IN ('poids_reps', 'reps', 'duree', 'poids_duree')),
  instructions_fr     text[] NOT NULL DEFAULT '{}',
  -- Chemins relatifs dans le bucket sport-exercices (0 à 2 images).
  images              text[] NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sport_exercices_muscle_idx ON public.sport_exercices (muscle_principal);

ALTER TABLE public.sport_exercices ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sport-exercices', 'sport-exercices', true, 2097152, ARRAY['image/webp', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;
