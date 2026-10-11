-- Catalogue Musculation : 15 exercices de plus (squat, relevé de bassin,
-- développés, écartés, tractions, dips…). Si un exercice du même nom existe
-- déjà, il est laissé tel quel.

insert into public.exercices (nom, mode_saisie, muscle_principal, muscles_secondaires, materiel, repos_defaut_s)
values
  ('Squat (barre)', 'poids_reps', 'quadriceps', array['ischios', 'fessiers'], 'Barre', 150),
  ('Relevé de bassin (barre)', 'poids_reps', 'fessiers', array['ischios', 'quadriceps', 'adducteurs'], 'Barre', 120),
  ('Curl poignets inversé (haltère)', 'poids_reps', 'avant_bras', '{}', 'Haltères', 60),
  ('Développé Arnold (haltère)', 'poids_reps', 'epaules', array['triceps'], 'Haltères', 90),
  ('Élévation en Y sur banc incliné (haltère)', 'poids_reps', 'epaules', array['trapezes'], 'Haltères', 60),
  ('Élévation frontale (haltère)', 'poids_reps', 'epaules', '{}', 'Haltères', 60),
  ('Développé militaire (haltère)', 'poids_reps', 'epaules', array['triceps'], 'Haltères', 90),
  ('Écarté (haltère)', 'poids_reps', 'pectoraux', '{}', 'Haltères', 75),
  ('Écarté (machine)', 'poids_reps', 'pectoraux', '{}', 'Machine', 75),
  ('Tractions supination', 'poids_corps_reps', 'dos', array['trapezes', 'biceps', 'avant_bras'], 'Barre de traction', 120),
  ('Rowing haltère', 'poids_reps', 'dos', array['trapezes', 'biceps', 'avant_bras'], 'Haltères', 90),
  ('Tractions', 'poids_corps_reps', 'dos', array['trapezes', 'biceps', 'avant_bras'], 'Barre de traction', 120),
  ('Dips sur banc', 'poids_corps_reps', 'triceps', array['epaules', 'pectoraux'], 'Banc', 90),
  ('Dips triceps au sol', 'poids_corps_reps', 'triceps', array['epaules'], 'Poids du corps', 60),
  ('Seal row (haltère)', 'poids_reps', 'dos', array['trapezes', 'biceps', 'avant_bras'], 'Haltères', 90)
on conflict (lower(btrim(nom))) do nothing;
