-- Catalogue Musculation : 15 exercices pratiqués (sans animation pour l'instant).
-- Si un exercice du même nom existe déjà, il est laissé tel quel.

insert into public.exercices (nom, mode_saisie, muscle_principal, muscles_secondaires, materiel, repos_defaut_s)
values
  ('Planche latérale', 'duree', 'abdos', '{}', 'Poids du corps', 60),
  ('Planche', 'duree', 'abdos', '{}', 'Poids du corps', 60),
  ('Crunch', 'poids_corps_reps', 'abdos', '{}', 'Poids du corps', 60),
  ('Abdos ciseaux', 'poids_corps_reps', 'abdos', '{}', 'Poids du corps', 60),
  ('Relevé de jambe barres parallèles', 'poids_corps_reps', 'abdos', '{}', 'Chaise romaine', 60),
  ('Leg curl assis (machine)', 'poids_reps', 'ischios', array['mollets'], 'Machine', 75),
  ('Extension jambes (machine)', 'poids_reps', 'quadriceps', '{}', 'Machine', 75),
  ('Adduction hanche (machine)', 'poids_reps', 'adducteurs', '{}', 'Machine', 75),
  ('Presse mollets (machine)', 'poids_reps', 'mollets', '{}', 'Machine', 60),
  ('Presse à cuisses horizontale', 'poids_reps', 'quadriceps', array['ischios', 'fessiers'], 'Machine', 120),
  ('Curl marteau (haltère)', 'poids_reps', 'biceps', array['avant_bras'], 'Haltères', 60),
  ('Curl biceps (haltère)', 'poids_reps', 'biceps', '{}', 'Haltères', 60),
  ('Extension dos (hyperextension lestée)', 'poids_corps_reps', 'lombaires', array['ischios', 'fessiers'], 'Banc d''hyperextension', 90),
  ('Tirage poitrine (poulie)', 'poids_reps', 'dos', array['trapezes', 'biceps', 'avant_bras'], 'Poulie', 90),
  ('Extension triceps poulie haute', 'poids_reps', 'triceps', '{}', 'Poulie', 60)
on conflict (lower(btrim(nom))) do nothing;
