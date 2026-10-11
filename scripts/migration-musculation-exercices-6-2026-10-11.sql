-- Catalogue Musculation : « Marche » (cardio, saisie distance + durée). Repos
-- par défaut à 0 : aucun minuteur de repos après une marche. Si un exercice du
-- même nom existe déjà, il est laissé tel quel.

insert into public.exercices (nom, mode_saisie, muscle_principal, muscles_secondaires, materiel, repos_defaut_s)
values
  ('Marche', 'distance_duree', 'cardio', '{}', null, 0)
on conflict (lower(btrim(nom))) do nothing;
