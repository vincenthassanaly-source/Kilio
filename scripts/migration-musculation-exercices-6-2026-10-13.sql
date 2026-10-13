-- Catalogue Musculation : traction verticale à la machine (grand dorsal en
-- principal ; le haut du dos est couvert par « dos »). Si un exercice du même
-- nom existe déjà, il est laissé tel quel.

insert into public.exercices (nom, mode_saisie, muscle_principal, muscles_secondaires, materiel, repos_defaut_s)
values
  ('Traction verticale (machine)', 'poids_reps', 'dos', array['biceps', 'avant_bras'], 'Machine', 90)
on conflict (lower(btrim(nom))) do nothing;
