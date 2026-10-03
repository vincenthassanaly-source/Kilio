-- Variantes Push / Pull / Legs (B et C) en plus des routines de départ
-- (scripts/seed-sport-routines-ppl-2026-10-02.sql), modifiables dans l'app (/sport).
-- Rejouable : une routine n'est créée que si son nom n'existe pas déjà.
-- Les exercices sont des identifiants de free-exercise-db (sport_exercices).
--
-- Ordre d'affichage regroupé par type : Push, Push B, Push C, Pull, Pull B,
-- Pull C, Legs, Legs B, Legs C. Les routines Pull et Legs existantes sont
-- décalées une seule fois (à la première exécution, quand « Push B » n'existe
-- pas encore), pour ne pas écraser un réordonnancement fait ensuite dans l'app.

WITH decalage AS (
  UPDATE public.sport_routines
  SET ordre = CASE nom WHEN 'Pull' THEN 3 ELSE 6 END
  WHERE nom IN ('Pull', 'Legs')
    AND NOT EXISTS (SELECT 1 FROM public.sport_routines WHERE nom = 'Push B')
  RETURNING id
),
r AS (
  INSERT INTO public.sport_routines (nom, ordre)
  SELECT v.nom, v.ordre
  FROM (VALUES
    ('Push B', 1), ('Push C', 2),
    ('Pull B', 4), ('Pull C', 5),
    ('Legs B', 7), ('Legs C', 8)
  ) AS v (nom, ordre)
  WHERE NOT EXISTS (SELECT 1 FROM public.sport_routines s WHERE s.nom = v.nom)
  RETURNING id, nom
)
INSERT INTO public.sport_routine_exercices (routine_id, exercice_id, position, nb_series, reps_cible, repos_s)
SELECT r.id, e.exercice_id, e.position, e.nb_series, e.reps_cible, e.repos_s
FROM r
JOIN (VALUES
  ('Push B', 'Barbell_Incline_Bench_Press_-_Medium_Grip', 0, 4, 8, 120),
  ('Push B', 'Dumbbell_Bench_Press', 1, 3, 10, 90),
  ('Push B', 'Machine_Shoulder_Military_Press', 2, 3, 10, 90),
  ('Push B', 'Cable_Crossover', 3, 3, 12, 60),
  ('Push B', 'Dips_-_Triceps_Version', 4, 3, 10, 90),
  ('Push B', 'Lying_Triceps_Press', 5, 3, 12, 60),
  ('Push C', 'Barbell_Shoulder_Press', 0, 4, 6, 120),
  ('Push C', 'Smith_Machine_Bench_Press', 1, 3, 10, 90),
  ('Push C', 'Arnold_Dumbbell_Press', 2, 3, 10, 90),
  ('Push C', 'Incline_Dumbbell_Flyes', 3, 3, 12, 60),
  ('Push C', 'Close-Grip_Barbell_Bench_Press', 4, 3, 8, 90),
  ('Push C', 'Triceps_Pushdown', 5, 3, 12, 60),
  ('Pull B', 'Chin-Up', 0, 4, 8, 120),
  ('Pull B', 'One-Arm_Dumbbell_Row', 1, 3, 10, 90),
  ('Pull B', 'Wide-Grip_Lat_Pulldown', 2, 3, 10, 90),
  ('Pull B', 'Cable_Rear_Delt_Fly', 3, 3, 15, 60),
  ('Pull B', 'Preacher_Curl', 4, 3, 10, 60),
  ('Pull B', 'Alternate_Hammer_Curl', 5, 3, 12, 60),
  ('Pull C', 'Barbell_Deadlift', 0, 3, 5, 180),
  ('Pull C', 'T-Bar_Row_with_Handle', 1, 4, 8, 120),
  ('Pull C', 'Close-Grip_Front_Lat_Pulldown', 2, 3, 10, 90),
  ('Pull C', 'Straight-Arm_Pulldown', 3, 3, 12, 60),
  ('Pull C', 'Dumbbell_Shrug', 4, 3, 12, 60),
  ('Pull C', 'Incline_Dumbbell_Curl', 5, 3, 12, 60),
  ('Legs B', 'Front_Barbell_Squat', 0, 4, 8, 150),
  ('Legs B', 'Stiff-Legged_Barbell_Deadlift', 1, 3, 10, 120),
  ('Legs B', 'Split_Squat_with_Dumbbells', 2, 3, 10, 90),
  ('Legs B', 'Seated_Leg_Curl', 3, 3, 12, 90),
  ('Legs B', 'Barbell_Hip_Thrust', 4, 3, 10, 90),
  ('Legs B', 'Seated_Calf_Raise', 5, 4, 15, 60),
  ('Legs C', 'Hack_Squat', 0, 4, 10, 120),
  ('Legs C', 'Sumo_Deadlift', 1, 3, 8, 150),
  ('Legs C', 'Dumbbell_Lunges', 2, 3, 12, 90),
  ('Legs C', 'Standing_Leg_Curl', 3, 3, 12, 90),
  ('Legs C', 'Leg_Extensions', 4, 3, 15, 60),
  ('Legs C', 'Calf_Press_On_The_Leg_Press_Machine', 5, 4, 15, 60)
) AS e (routine, exercice_id, position, nb_series, reps_cible, repos_s) ON e.routine = r.nom;
