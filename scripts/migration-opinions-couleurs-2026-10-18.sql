-- Module Opinions, couleurs : une teinte par parti (palette fermée de 10, voir
-- COULEURS_PARTI dans src/lib/opinions/couleurs.ts) et, par proposition, les
-- mots-clés à surligner avec leur définition facultative.
-- `termes` : [{"terme": "TVA", "definition": "un impôt sur ce qu'on achète"}] ;
-- chaque terme doit apparaître tel quel dans `position` (vérifié par l'app).
-- Les partis existants reçoivent une teinte chacun, dans l'ordre de création.

begin;

alter table opinions_partis
  add column couleur text not null default 'indigo'
    check (couleur in ('indigo','corail','olive','prune','turquoise','ambre','ardoise','rose','vert','violet'));

with numerotes as (
  select id, row_number() over (order by created_at, id) - 1 as rang
  from opinions_partis
)
update opinions_partis p
set couleur = (array['indigo','corail','olive','prune','turquoise','ambre','ardoise','rose','vert','violet'])[(n.rang % 10) + 1]
from numerotes n
where p.id = n.id;

alter table opinions_propositions
  add column termes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(termes) = 'array');

commit;
