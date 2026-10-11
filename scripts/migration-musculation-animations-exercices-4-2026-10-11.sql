-- Associe leur animation aux 7 exercices ajoutés ensuite au catalogue
-- (fichiers dans public/animations/musculation, clés dans
-- src/lib/musculation/animations.ts). Rapprochement par le nom. « Squat
-- (machine Smith) » réutilise l'animation du squat à la barre, « Relevé de
-- bassin (haltère) » celle du relevé de bassin à la barre.

update public.exercices as e
set animation = v.animation
from (values
  ('Squat (machine Smith)', 'squat-barre'),
  ('Split squat bulgare (haltère)', 'split-squat-bulgare-haltere'),
  ('Goblet squat', 'goblet-squat'),
  ('Relevé de bassin (haltère)', 'releve-bassin-barre'),
  ('Fentes (haltère)', 'fentes-haltere'),
  ('Soulevé de terre roumain (haltère)', 'souleve-terre-roumain-haltere'),
  ('Squat (haltère)', 'squat-haltere')
) as v(nom, animation)
where lower(btrim(e.nom)) = lower(v.nom);
