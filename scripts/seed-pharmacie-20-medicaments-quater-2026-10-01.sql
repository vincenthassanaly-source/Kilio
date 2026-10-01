-- 20 médicaments courants supplémentaires (nouvelles classes, molécules,
-- spécialités et dosages). Spécialités et dosages vérifiés dans la base publique
-- des médicaments (base-donnees-publique.medicaments.gouv.fr). Rejouable sans doublon.
-- Retour arrière : seed-pharmacie-20-medicaments-quater-2026-10-01-revert.sql.

-- 1. Classe racine
insert into public.pharma_ref_classes (nom)
values ('Psychiatrie')
on conflict ((lower(nom))) do nothing;

-- 2. Sous-classes (parent existant ou créé ci-dessus)
insert into public.pharma_ref_classes (nom, parent_id)
select v.nom, p.id
from (values
  ('Héparines de bas poids moléculaire', 'Antithrombotiques'),
  ('Fibrates', 'Hypolipémiants'),
  ('Inhibiteurs du courant If', 'Cardiologie'),
  ('Anti-inflammatoires intestinaux', 'Gastro-entérologie'),
  ('Thymorégulateurs', 'Psychiatrie'),
  ('Sulfamides antibactériens', 'Antibiotiques'),
  ('Antifongiques allylamines', 'Antifongiques')
) as v(nom, parent)
join public.pharma_ref_classes p on lower(p.nom) = lower(v.parent)
on conflict ((lower(nom))) do nothing;

-- 3. Molécules (le cotrimoxazole est une association fixe)
insert into public.pharma_ref_molecules (dci, classe_id)
select v.dci, c.id
from (values
  ('enoxaparine', 'Héparines de bas poids moléculaire'),
  ('ticagrélor', 'Antiagrégants plaquettaires'),
  ('fénofibrate', 'Fibrates'),
  ('diltiazem', 'Inhibiteurs calciques'),
  ('ivabradine', 'Inhibiteurs du courant If'),
  ('glimépiride', 'Sulfamides hypoglycémiants'),
  ('liraglutide', 'Agonistes du GLP-1'),
  ('desloratadine', 'Antihistaminiques H1'),
  ('métoclopramide', 'Antiémétiques'),
  ('mésalazine', 'Anti-inflammatoires intestinaux'),
  ('lactulose', 'Laxatifs'),
  ('naproxène', 'AINS'),
  ('oxycodone', 'Antalgiques opioïdes'),
  ('lévétiracétam', 'Antiépileptiques'),
  ('olanzapine', 'Antipsychotiques atypiques'),
  ('lithium', 'Thymorégulateurs'),
  ('clarithromycine', 'Macrolides'),
  ('aciclovir', 'Antiherpétiques'),
  ('terbinafine', 'Antifongiques allylamines')
) as v(dci, classe)
join public.pharma_ref_classes c on lower(c.nom) = lower(v.classe)
on conflict ((lower(dci))) do nothing;

insert into public.pharma_ref_molecules (dci, classe_id, association, composants)
select 'sulfaméthoxazole + triméthoprime', c.id, true, array['sulfaméthoxazole', 'triméthoprime']
from public.pharma_ref_classes c
where lower(c.nom) = 'sulfamides antibactériens'
on conflict ((lower(dci))) do nothing;

-- 4. Spécialités et dosages
insert into public.pharma_ref_specialites (molecule_id, nom, dosages)
select m.id, s.nom, s.dosages
from (values
  ('enoxaparine', 'Lovenox', '20 mg, 40 mg, 60 mg, 80 mg, 100 mg, 120 mg, 150 mg (seringues) ; 300 mg/3 mL (flacon)'),
  ('ticagrélor', 'Brilique', '90 mg'),
  ('fénofibrate', 'Lipanthyl', '145 mg (comprimé), 67 mg et 200 mg (gélules micronisées)'),
  ('diltiazem', 'Tildiem', '60 mg'),
  ('diltiazem', 'Mono Tildiem LP', '200 mg, 300 mg'),
  ('ivabradine', 'Procoralan', '5 mg, 7,5 mg'),
  ('glimépiride', 'Amarel', '1 mg, 3 mg, 4 mg'),
  ('liraglutide', 'Victoza', '6 mg/mL (stylo)'),
  ('desloratadine', 'Aerius', '5 mg'),
  ('métoclopramide', 'Primpéran', '10 mg'),
  ('mésalazine', 'Pentasa', 'comprimé 500 mg, 1 g ; granulés 1 g, 2 g ; suppositoire 1 g'),
  ('lactulose', 'Duphalac', '10 g/15 mL (sachet)'),
  ('naproxène', 'Apranax', '275 mg, 550 mg, 750 mg'),
  ('oxycodone', 'Oxynorm', '5 mg, 10 mg, 20 mg'),
  ('oxycodone', 'Oxycontin LP', '5 mg, 10 mg, 15 mg, 20 mg, 30 mg, 40 mg, 60 mg, 80 mg, 120 mg'),
  ('lévétiracétam', 'Keppra', '250 mg, 500 mg, 1000 mg'),
  ('olanzapine', 'Zyprexa', '5 mg, 10 mg'),
  ('lithium', 'Téralithe', '250 mg'),
  ('lithium', 'Téralithe LP', '400 mg'),
  ('clarithromycine', 'Zeclar', '250 mg, 500 mg'),
  ('sulfaméthoxazole + triméthoprime', 'Bactrim', '400 mg/80 mg (comprimé), 40 mg/8 mg par mL (suspension)'),
  ('sulfaméthoxazole + triméthoprime', 'Bactrim Forte', '800 mg/160 mg'),
  ('aciclovir', 'Zovirax', '200 mg, 800 mg'),
  ('terbinafine', 'Lamisil', '250 mg')
) as s(dci, nom, dosages)
join public.pharma_ref_molecules m on lower(m.dci) = lower(s.dci)
on conflict (molecule_id, (lower(nom))) do nothing;
