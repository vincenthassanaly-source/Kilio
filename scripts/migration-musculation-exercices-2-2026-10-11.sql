-- Catalogue Musculation : 14 exercices de plus (sans animation pour l'instant).
-- Si un exercice du même nom existe déjà, il est laissé tel quel.

insert into public.exercices (nom, mode_saisie, muscle_principal, muscles_secondaires, materiel, repos_defaut_s)
values
  ('Chest press (machine)', 'poids_reps', 'pectoraux', array['epaules', 'triceps'], 'Machine', 90),
  ('Butterfly (pec deck)', 'poids_reps', 'pectoraux', '{}', 'Machine', 75),
  ('Développé épaules assis (machine)', 'poids_reps', 'epaules', array['triceps'], 'Machine', 90),
  ('Extension triceps (machine)', 'poids_reps', 'triceps', '{}', 'Machine', 60),
  ('Relevé de genoux allongé', 'poids_corps_reps', 'abdos', '{}', 'Poids du corps', 60),
  ('Toucher orteils', 'poids_corps_reps', 'abdos', '{}', 'Poids du corps', 60),
  ('Tirage poitrine prise serrée (poulie)', 'poids_reps', 'dos', array['trapezes', 'biceps', 'avant_bras'], 'Poulie', 90),
  ('Curl biceps (machine)', 'poids_reps', 'biceps', '{}', 'Machine', 60),
  ('Curl marteau (poulie)', 'poids_reps', 'biceps', array['avant_bras'], 'Poulie', 60),
  ('Développé couché (barre)', 'poids_reps', 'pectoraux', array['triceps', 'epaules'], 'Barre', 120),
  ('Extension triceps corde', 'poids_reps', 'triceps', '{}', 'Poulie', 60),
  ('Shrug (haltère)', 'poids_reps', 'trapezes', '{}', 'Haltères', 75),
  ('Curl biceps (barre)', 'poids_reps', 'biceps', '{}', 'Barre', 60),
  ('Tirage vers le visage', 'poids_reps', 'epaules', array['biceps'], 'Poulie', 60)
on conflict (lower(btrim(nom))) do nothing;
