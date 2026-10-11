-- Associe leur animation aux 14 exercices ajoutés ensuite au catalogue
-- (fichiers dans public/animations/musculation, clés dans
-- src/lib/musculation/animations.ts). Le rapprochement se fait sur le nom.

update public.exercices as e
set animation = v.animation
from (values
  ('Chest press (machine)', 'chest-press-machine'),
  ('Développé épaules assis (machine)', 'developpe-epaules-machine'),
  ('Extension triceps (machine)', 'extension-triceps-machine'),
  ('Butterfly (pec deck)', 'butterfly'),
  ('Curl biceps (machine)', 'curl-biceps-machine'),
  ('Tirage poitrine prise serrée (poulie)', 'tirage-poitrine-prise-serree'),
  ('Relevé de genoux allongé', 'releve-genoux-allonge'),
  ('Toucher orteils', 'toucher-orteils'),
  ('Développé couché (barre)', 'developpe-couche-barre'),
  ('Curl biceps (barre)', 'curl-biceps-barre'),
  ('Shrug (haltère)', 'shrug-haltere'),
  ('Extension triceps corde', 'extension-triceps-corde'),
  ('Curl marteau (poulie)', 'curl-marteau-poulie'),
  ('Tirage vers le visage', 'tirage-visage')
) as v(nom, animation)
where lower(btrim(e.nom)) = lower(v.nom);
