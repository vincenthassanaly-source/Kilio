-- 19 médicaments courants supplémentaires (nouvelles classes, molécules,
-- spécialités et dosages). Spécialités et dosages vérifiés dans la base publique
-- des médicaments (base-donnees-publique.medicaments.gouv.fr). Rejouable sans doublon.
-- Retour arrière : seed-pharmacie-19-medicaments-2026-10-01-revert.sql.

-- 1. Classe racine
insert into public.pharma_ref_classes (nom)
values ('Antiparasitaires')
on conflict ((lower(nom))) do nothing;

-- 2. Sous-classes (parent existant ou créé ci-dessus)
insert into public.pharma_ref_classes (nom, parent_id)
select v.nom, p.id
from (values
  ('Antagonistes des récepteurs NMDA', 'Neurologie'),
  ('Myorelaxants', 'Neurologie'),
  ('Synergistines', 'Antibiotiques'),
  ('Antigrippaux', 'Antiviraux'),
  ('Anthelminthiques', 'Antiparasitaires'),
  ('Antimuscariniques urinaires', 'Urologie')
) as v(nom, parent)
join public.pharma_ref_classes p on lower(p.nom) = lower(v.parent)
on conflict ((lower(nom))) do nothing;

-- 3. Molécules
insert into public.pharma_ref_molecules (dci, classe_id)
select v.dci, c.id
from (values
  ('vérapamil', 'Inhibiteurs calciques'),
  ('carvédilol', 'Bêtabloquants'),
  ('énalapril', 'IEC'),
  ('dabigatran', 'Anticoagulants oraux directs'),
  ('fluindione', 'Antivitamines K'),
  ('alprazolam', 'Benzodiazépines'),
  ('lorazépam', 'Benzodiazépines'),
  ('citalopram', 'ISRS'),
  ('topiramate', 'Antiépileptiques'),
  ('valproate de sodium', 'Antiépileptiques'),
  ('mémantine', 'Antagonistes des récepteurs NMDA'),
  ('baclofène', 'Myorelaxants'),
  ('pristinamycine', 'Synergistines'),
  ('oseltamivir', 'Antigrippaux'),
  ('ivermectine', 'Anthelminthiques'),
  ('solifénacine', 'Antimuscariniques urinaires'),
  ('alfuzosine', 'Alpha-bloquants'),
  ('mébévérine', 'Antispasmodiques'),
  ('tadalafil', 'Inhibiteurs de la PDE5')
) as v(dci, classe)
join public.pharma_ref_classes c on lower(c.nom) = lower(v.classe)
on conflict ((lower(dci))) do nothing;

-- 4. Spécialités et dosages
insert into public.pharma_ref_specialites (molecule_id, nom, dosages)
select m.id, s.nom, s.dosages
from (values
  ('vérapamil', 'Isoptine LP', '240 mg'),
  ('carvédilol', 'Kredex', '6,25 mg, 12,5 mg, 25 mg'),
  ('énalapril', 'Renitec', '5 mg, 20 mg'),
  ('dabigatran', 'Pradaxa', '75 mg, 110 mg, 150 mg'),
  ('fluindione', 'Préviscan', '20 mg'),
  ('alprazolam', 'Xanax', '0,25 mg, 0,50 mg, 1 mg'),
  ('lorazépam', 'Temesta', '1 mg, 2,5 mg'),
  ('citalopram', 'Seropram', '20 mg'),
  ('topiramate', 'Epitomax', '50 mg, 100 mg, 200 mg (comprimés) ; 15 mg, 25 mg (gélules)'),
  ('valproate de sodium', 'Dépakine', '200 mg, 500 mg'),
  ('valproate de sodium', 'Dépakine Chrono', '500 mg'),
  ('mémantine', 'Ebixa', '10 mg, 20 mg'),
  ('baclofène', 'Liorésal', '10 mg'),
  ('pristinamycine', 'Pyostacine', '250 mg, 500 mg'),
  ('oseltamivir', 'Tamiflu', '30 mg, 75 mg'),
  ('ivermectine', 'Stromectol', '3 mg'),
  ('solifénacine', 'Vesicare', '5 mg, 10 mg'),
  ('alfuzosine', 'Xatral LP', '10 mg'),
  ('mébévérine', 'Duspatalin', '200 mg (gélule), 100 mg (comprimé)'),
  ('tadalafil', 'Cialis', '2,5 mg, 5 mg, 10 mg, 20 mg')
) as s(dci, nom, dosages)
join public.pharma_ref_molecules m on lower(m.dci) = lower(s.dci)
on conflict (molecule_id, (lower(nom))) do nothing;
