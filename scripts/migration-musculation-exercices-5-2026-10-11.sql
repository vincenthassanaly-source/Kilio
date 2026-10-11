-- Catalogue Musculation : 7 exercices de plus (squats, fentes, soulevé de terre
-- roumain, relevé de bassin haltère). Si un exercice du même nom existe déjà,
-- il est laissé tel quel.

insert into public.exercices (nom, mode_saisie, muscle_principal, muscles_secondaires, materiel, repos_defaut_s)
values
  ('Squat (machine Smith)', 'poids_reps', 'quadriceps', array['ischios', 'fessiers'], 'Machine Smith', 150),
  ('Split squat bulgare (haltère)', 'poids_reps', 'quadriceps', array['fessiers', 'ischios'], 'Haltères', 90),
  ('Goblet squat', 'poids_reps', 'quadriceps', array['ischios', 'fessiers'], 'Haltère', 90),
  ('Relevé de bassin (haltère)', 'poids_reps', 'fessiers', array['ischios', 'quadriceps', 'adducteurs'], 'Haltère', 120),
  ('Fentes (haltère)', 'poids_reps', 'quadriceps', array['ischios', 'fessiers'], 'Haltères', 90),
  ('Soulevé de terre roumain (haltère)', 'poids_reps', 'ischios', array['fessiers', 'lombaires', 'trapezes', 'dos'], 'Haltères', 120),
  ('Squat (haltère)', 'poids_reps', 'quadriceps', array['ischios', 'fessiers'], 'Haltères', 120)
on conflict (lower(btrim(nom))) do nothing;
