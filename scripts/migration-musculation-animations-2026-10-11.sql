-- Animations d'exercices (Musculation).
--
-- • exercices.animation : clé d'une animation WebM rendue avec Hyperframes,
--   servie depuis public/animations/musculation/<clé>.webm (voir
--   src/lib/musculation/animations.ts). Null = l'exercice n'a pas d'animation,
--   rien n'est affiché.
-- • Ajoute au catalogue les 3 exercices pratiqués, avec leur animation. Si un
--   exercice du même nom existe déjà, il reçoit seulement l'animation.

alter table public.exercices
  add column animation text null check (animation is null or animation ~ '^[a-z0-9-]{1,60}$');

insert into public.exercices (nom, mode_saisie, muscle_principal, muscles_secondaires, materiel, repos_defaut_s, animation)
values
  ('Élévation latérale (haltère)', 'poids_reps', 'epaules', array['trapezes'], 'Haltères', 60, 'elevation-laterale'),
  ('Développé couché (haltère)', 'poids_reps', 'pectoraux', array['triceps', 'epaules'], 'Haltères', 120, 'developpe-couche'),
  ('Développé couché incliné (haltère)', 'poids_reps', 'pectoraux', array['triceps', 'epaules'], 'Haltères', 120, 'developpe-couche-incline')
on conflict (lower(btrim(nom))) do update set animation = excluded.animation;
