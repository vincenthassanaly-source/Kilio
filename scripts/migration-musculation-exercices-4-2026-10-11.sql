-- Catalogue Musculation : 12 exercices de plus (rowings, superman, dead bug,
-- jackknife, élévation disque, oiseau penché, développé épaules haltère).
-- Si un exercice du même nom existe déjà, il est laissé tel quel.

insert into public.exercices (nom, mode_saisie, muscle_principal, muscles_secondaires, materiel, repos_defaut_s)
values
  ('Rowing poulie assis', 'poids_reps', 'dos', array['biceps', 'avant_bras'], 'Poulie', 90),
  ('Rowing poulie assis prise large', 'poids_reps', 'dos', array['trapezes', 'biceps', 'avant_bras'], 'Poulie', 90),
  ('Rowing poulie assis prise en V', 'poids_reps', 'dos', array['biceps', 'avant_bras'], 'Poulie', 90),
  ('Rowing assis (machine)', 'poids_reps', 'dos', array['biceps', 'avant_bras'], 'Machine', 90),
  ('Rowing penché (haltère)', 'poids_reps', 'dos', array['biceps', 'avant_bras'], 'Haltères', 90),
  ('Rowing incliné buste appuyé (haltère)', 'poids_reps', 'dos', array['biceps', 'avant_bras'], 'Haltères', 90),
  ('Superman', 'poids_corps_reps', 'lombaires', array['fessiers', 'ischios'], 'Poids du corps', 60),
  ('Dead bug', 'poids_corps_reps', 'abdos', '{}', 'Poids du corps', 60),
  ('Sit-up jackknife', 'poids_corps_reps', 'abdos', '{}', 'Poids du corps', 60),
  ('Élévation disque frontale', 'poids_reps', 'epaules', '{}', 'Disque', 60),
  ('Oiseau penché (haltère)', 'poids_reps', 'epaules', array['trapezes'], 'Haltères', 60),
  ('Développé épaules (haltère)', 'poids_reps', 'epaules', array['triceps'], 'Haltères', 90)
on conflict (lower(btrim(nom))) do nothing;
