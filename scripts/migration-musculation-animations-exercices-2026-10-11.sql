-- Associe leur animation aux 15 exercices ajoutés au catalogue
-- (fichiers dans public/animations/musculation, clés dans
-- src/lib/musculation/animations.ts). Le rapprochement se fait sur le nom.

update public.exercices as e
set animation = v.animation
from (values
  ('Planche', 'planche'),
  ('Planche latérale', 'planche-laterale'),
  ('Crunch', 'crunch'),
  ('Abdos ciseaux', 'abdos-ciseaux'),
  ('Relevé de jambe barres parallèles', 'releve-jambe-barres-paralleles'),
  ('Extension dos (hyperextension lestée)', 'extension-dos-hyperextension'),
  ('Leg curl assis (machine)', 'leg-curl-assis'),
  ('Extension jambes (machine)', 'extension-jambes'),
  ('Adduction hanche (machine)', 'adduction-hanche'),
  ('Presse mollets (machine)', 'presse-mollets'),
  ('Presse à cuisses horizontale', 'presse-cuisses-horizontale'),
  ('Tirage poitrine (poulie)', 'tirage-poitrine-poulie'),
  ('Curl marteau (haltère)', 'curl-marteau'),
  ('Curl biceps (haltère)', 'curl-biceps'),
  ('Extension triceps poulie haute', 'extension-triceps-poulie-haute')
) as v(nom, animation)
where lower(btrim(e.nom)) = lower(v.nom);
