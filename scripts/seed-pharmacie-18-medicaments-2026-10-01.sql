-- 18 médicaments courants supplémentaires (nouvelles classes, molécules,
-- spécialités et dosages). Spécialités et dosages vérifiés dans la base publique
-- des médicaments (base-donnees-publique.medicaments.gouv.fr). Rejouable sans doublon.
-- Retour arrière : seed-pharmacie-18-medicaments-2026-10-01-revert.sql.

-- 1. Sous-classes (parents déjà existants)
insert into public.pharma_ref_classes (nom, parent_id)
select v.nom, p.id
from (values
  ('Cardiotoniques', 'Cardiologie'),
  ('Dérivés nitrés', 'Cardiologie'),
  ('Agonistes dopaminergiques', 'Antiparkinsoniens'),
  ('Antithyroïdiens de synthèse', 'Thyroïde')
) as v(nom, parent)
join public.pharma_ref_classes p on lower(p.nom) = lower(v.parent)
on conflict ((lower(nom))) do nothing;

-- 2. Molécules simples
insert into public.pharma_ref_molecules (dci, classe_id)
select v.dci, c.id
from (values
  ('métoprolol', 'Bêtabloquants'),
  ('digoxine', 'Cardiotoniques'),
  ('trinitrine', 'Dérivés nitrés'),
  ('racécadotril', 'Antidiarrhéiques'),
  ('dompéridone', 'Antiémétiques'),
  ('fentanyl', 'Antalgiques opioïdes'),
  ('gabapentine', 'Antiépileptiques'),
  ('rispéridone', 'Antipsychotiques atypiques'),
  ('ropinirole', 'Agonistes dopaminergiques'),
  ('duloxétine', 'IRSNA'),
  ('clonazépam', 'Benzodiazépines'),
  ('nitrofurantoïne', 'Antibiotiques urinaires'),
  ('lévofloxacine', 'Fluoroquinolones'),
  ('prednisone', 'Corticoïdes'),
  ('carbimazole', 'Antithyroïdiens de synthèse'),
  ('acide folique', 'Antianémiques')
) as v(dci, classe)
join public.pharma_ref_classes c on lower(c.nom) = lower(v.classe)
on conflict ((lower(dci))) do nothing;

-- 3. Associations fixes
insert into public.pharma_ref_molecules (dci, classe_id, association, composants)
select v.dci, c.id, true, v.composants
from (values
  ('budésonide + formotérol', 'Associations CSI + LABA', array['budésonide', 'formotérol']),
  ('amoxicilline + acide clavulanique', 'Pénicillines', array['amoxicilline', 'acide clavulanique'])
) as v(dci, classe, composants)
join public.pharma_ref_classes c on lower(c.nom) = lower(v.classe)
on conflict ((lower(dci))) do nothing;

-- 4. Spécialités et dosages
insert into public.pharma_ref_specialites (molecule_id, nom, dosages)
select m.id, s.nom, s.dosages
from (values
  ('métoprolol', 'Lopressor', '100 mg'),
  ('métoprolol', 'Lopressor LP', '200 mg'),
  ('digoxine', 'Digoxine Nativelle', '0,25 mg'),
  ('digoxine', 'Hémigoxine Nativelle', '0,125 mg'),
  ('trinitrine', 'Natispray', '0,15 mg/dose, 0,30 mg/dose'),
  ('budésonide + formotérol', 'Symbicort Turbuhaler', '100/6 µg, 400/12 µg par dose'),
  ('budésonide + formotérol', 'Symbicort Rapihaler', '200/6 µg par dose'),
  ('racécadotril', 'Tiorfan', '100 mg (gélule), 10 mg nourrissons et 30 mg enfants (sachets)'),
  ('dompéridone', 'Motilium', '10 mg'),
  ('fentanyl', 'Durogesic', '12 µg/h, 25 µg/h, 50 µg/h, 75 µg/h, 100 µg/h (patch)'),
  ('gabapentine', 'Neurontin', '100 mg, 300 mg, 400 mg (gélules) ; 600 mg, 800 mg (comprimés)'),
  ('rispéridone', 'Risperdal', '1 mg, 2 mg, 4 mg'),
  ('ropinirole', 'Requip', '0,25 mg, 0,5 mg, 1 mg, 2 mg, 5 mg'),
  ('duloxétine', 'Cymbalta', '30 mg, 60 mg'),
  ('clonazépam', 'Rivotril', '2 mg (comprimé), 2,5 mg/mL (gouttes)'),
  ('amoxicilline + acide clavulanique', 'Augmentin', '500 mg/62,5 mg'),
  ('nitrofurantoïne', 'Furadantine', '50 mg'),
  ('lévofloxacine', 'Tavanic', '500 mg'),
  ('prednisone', 'Cortancyl', '5 mg, 20 mg'),
  ('carbimazole', 'Néo-Mercazole', '5 mg, 20 mg'),
  ('acide folique', 'Speciafoldine', '0,4 mg, 5 mg')
) as s(dci, nom, dosages)
join public.pharma_ref_molecules m on lower(m.dci) = lower(s.dci)
on conflict (molecule_id, (lower(nom))) do nothing;
