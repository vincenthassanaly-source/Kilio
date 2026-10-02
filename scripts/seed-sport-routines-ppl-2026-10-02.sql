-- Routines de départ Push / Pull / Legs (modifiables dans l'app, /sport).
-- N'insère rien si une routine existe déjà : rejouable sans doublon.
-- Les exercices sont des identifiants de free-exercise-db (sport_exercices).

WITH r AS (
  INSERT INTO public.sport_routines (nom, ordre)
  SELECT v.nom, v.ordre
  FROM (VALUES ('Push', 0), ('Pull', 1), ('Legs', 2)) AS v (nom, ordre)
  WHERE NOT EXISTS (SELECT 1 FROM public.sport_routines)
  RETURNING id, nom
)
INSERT INTO public.sport_routine_exercices (routine_id, exercice_id, position, nb_series, reps_cible, repos_s)
SELECT r.id, e.exercice_id, e.position, e.nb_series, e.reps_cible, e.repos_s
FROM r
JOIN (VALUES
  ('Push', 'Barbell_Bench_Press_-_Medium_Grip', 0, 4, 8, 120),
  ('Push', 'Incline_Dumbbell_Press', 1, 3, 10, 90),
  ('Push', 'Dumbbell_Shoulder_Press', 2, 3, 10, 90),
  ('Push', 'Side_Lateral_Raise', 3, 3, 15, 60),
  ('Push', 'Triceps_Pushdown_-_Rope_Attachment', 4, 3, 12, 60),
  ('Pull', 'Pullups', 0, 4, 8, 120),
  ('Pull', 'Bent_Over_Barbell_Row', 1, 4, 8, 120),
  ('Pull', 'Seated_Cable_Rows', 2, 3, 10, 90),
  ('Pull', 'Face_Pull', 3, 3, 15, 60),
  ('Pull', 'Barbell_Curl', 4, 3, 10, 60),
  ('Pull', 'Hammer_Curls', 5, 3, 12, 60),
  ('Legs', 'Barbell_Squat', 0, 4, 8, 150),
  ('Legs', 'Romanian_Deadlift', 1, 3, 10, 120),
  ('Legs', 'Leg_Press', 2, 3, 12, 120),
  ('Legs', 'Lying_Leg_Curls', 3, 3, 12, 90),
  ('Legs', 'Leg_Extensions', 4, 3, 12, 90),
  ('Legs', 'Standing_Calf_Raises', 5, 4, 12, 60)
) AS e (routine, exercice_id, position, nb_series, reps_cible, repos_s) ON e.routine = r.nom;
