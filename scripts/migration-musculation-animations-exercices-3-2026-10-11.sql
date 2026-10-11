-- Associe leur animation aux 27 exercices ajoutés ensuite au catalogue
-- (fichiers dans public/animations/musculation, clés dans
-- src/lib/musculation/animations.ts). Le rapprochement se fait sur le nom.
-- Plusieurs exercices peuvent partager une animation : « Écarté (machine) »
-- réutilise celle du butterfly, les trois rowings à la poulie assise celle du
-- rowing poulie assis.

update public.exercices as e
set animation = v.animation
from (values
  ('Squat (barre)', 'squat-barre'),
  ('Relevé de bassin (barre)', 'releve-bassin-barre'),
  ('Rowing haltère', 'rowing-haltere'),
  ('Curl poignets inversé (haltère)', 'curl-poignets-inverse-haltere'),
  ('Seal row (haltère)', 'seal-row-haltere'),
  ('Écarté (haltère)', 'ecarte-haltere'),
  ('Écarté (machine)', 'butterfly'),
  ('Développé Arnold (haltère)', 'developpe-arnold-haltere'),
  ('Développé militaire (haltère)', 'developpe-militaire-haltere'),
  ('Élévation frontale (haltère)', 'elevation-frontale-haltere'),
  ('Élévation en Y sur banc incliné (haltère)', 'elevation-y-banc-incline'),
  ('Dips sur banc', 'dips-banc'),
  ('Dips triceps au sol', 'dips-sol'),
  ('Tractions', 'tractions'),
  ('Tractions supination', 'tractions-supination'),
  ('Rowing poulie assis', 'rowing-poulie-assis'),
  ('Rowing poulie assis prise large', 'rowing-poulie-assis'),
  ('Rowing poulie assis prise en V', 'rowing-poulie-assis'),
  ('Rowing assis (machine)', 'rowing-assis-machine'),
  ('Rowing penché (haltère)', 'rowing-penche-haltere'),
  ('Rowing incliné buste appuyé (haltère)', 'rowing-incline-buste-appuye'),
  ('Oiseau penché (haltère)', 'oiseau-penche-haltere'),
  ('Élévation disque frontale', 'elevation-disque-frontale'),
  ('Développé épaules (haltère)', 'developpe-epaules-haltere'),
  ('Superman', 'superman'),
  ('Dead bug', 'dead-bug'),
  ('Sit-up jackknife', 'sit-up-jackknife')
) as v(nom, animation)
where lower(btrim(e.nom)) = lower(v.nom);
