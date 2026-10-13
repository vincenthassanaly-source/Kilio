-- Associe son animation à « Traction verticale (machine) » (fichiers dans
-- public/animations/musculation, clé dans src/lib/musculation/animations.ts).
-- Rapprochement par le nom.

update public.exercices as e
set animation = v.animation
from (values
  ('Traction verticale (machine)', 'traction-verticale-machine')
) as v(nom, animation)
where lower(btrim(e.nom)) = lower(v.nom);
