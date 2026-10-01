-- 19 médicaments courants supplémentaires (nouvelles classes, molécules,
-- spécialités et dosages). Spécialités et dosages vérifiés dans la base publique
-- des médicaments (base-donnees-publique.medicaments.gouv.fr). Rejouable sans doublon.
-- Retour arrière : seed-pharmacie-19-medicaments-bis-2026-10-01-revert.sql.

-- 1. Sous-classes (parents déjà existants)
insert into public.pharma_ref_classes (nom, parent_id)
select v.nom, p.id
from (values
  ('Glinides', 'Antidiabétiques'),
  ('Butyrophénones', 'Antipsychotiques'),
  ('Lincosamides', 'Antibiotiques'),
  ('Antifibrinolytiques', 'Hématologie')
) as v(nom, parent)
join public.pharma_ref_classes p on lower(p.nom) = lower(v.parent)
on conflict ((lower(nom))) do nothing;

-- 2. Molécules
insert into public.pharma_ref_molecules (dci, classe_id)
select v.dci, c.id
from (values
  ('aténolol', 'Bêtabloquants'),
  ('lisinopril', 'IEC'),
  ('nifédipine', 'Inhibiteurs calciques'),
  ('flécaïnide', 'Antiarythmiques'),
  ('répaglinide', 'Glinides'),
  ('vildagliptine', 'Inhibiteurs de la DPP-4'),
  ('lévocétirizine', 'Antihistaminiques H1'),
  ('terbutaline', 'Bêta-2 mimétiques de courte durée'),
  ('dutastéride', 'Inhibiteurs de la 5-alpha-réductase'),
  ('oxybutynine', 'Antimuscariniques urinaires'),
  ('carbamazépine', 'Antiépileptiques'),
  ('lacosamide', 'Antiépileptiques'),
  ('pramipexole', 'Agonistes dopaminergiques'),
  ('diazépam', 'Benzodiazépines'),
  ('halopéridol', 'Butyrophénones'),
  ('clindamycine', 'Lincosamides'),
  ('spiramycine', 'Macrolides'),
  ('méthylprednisolone', 'Corticoïdes'),
  ('acide tranexamique', 'Antifibrinolytiques')
) as v(dci, classe)
join public.pharma_ref_classes c on lower(c.nom) = lower(v.classe)
on conflict ((lower(dci))) do nothing;

-- 3. Spécialités et dosages
insert into public.pharma_ref_specialites (molecule_id, nom, dosages)
select m.id, s.nom, s.dosages
from (values
  ('aténolol', 'Ténormine', '50 mg, 100 mg'),
  ('lisinopril', 'Zestril', '5 mg, 20 mg'),
  ('nifédipine', 'Adalate', '10 mg (capsule)'),
  ('nifédipine', 'Chronadalate LP', '30 mg'),
  ('flécaïnide', 'Flécaïne LP', '50 mg, 100 mg, 150 mg, 200 mg'),
  ('répaglinide', 'Novonorm', '0,5 mg, 1 mg, 2 mg'),
  ('vildagliptine', 'Galvus', '50 mg'),
  ('lévocétirizine', 'Xyzall', '5 mg'),
  ('terbutaline', 'Bricanyl Turbuhaler', '500 µg/dose'),
  ('terbutaline', 'Bricanyl', '5 mg/2 mL (nébuliseur)'),
  ('dutastéride', 'Avodart', '0,5 mg'),
  ('oxybutynine', 'Ditropan', '5 mg'),
  ('carbamazépine', 'Tégrétol', '200 mg'),
  ('carbamazépine', 'Tégrétol LP', '200 mg, 400 mg'),
  ('lacosamide', 'Vimpat', '50 mg, 100 mg, 150 mg, 200 mg'),
  ('pramipexole', 'Sifrol', '0,18 mg, 0,7 mg'),
  ('pramipexole', 'Sifrol LP', '0,26 mg, 0,52 mg, 1,05 mg, 2,1 mg, 3,15 mg'),
  ('diazépam', 'Valium', '2 mg, 5 mg, 10 mg'),
  ('halopéridol', 'Haldol', '1 mg, 5 mg (comprimés), 2 mg/mL (solution buvable)'),
  ('clindamycine', 'Dalacine', '75 mg, 150 mg, 300 mg'),
  ('spiramycine', 'Rovamycine', '1,5 MUI, 3 MUI'),
  ('méthylprednisolone', 'Médrol', '4 mg, 16 mg, 100 mg'),
  ('acide tranexamique', 'Exacyl', '500 mg (comprimé), 1 g/10 mL (solution buvable)')
) as s(dci, nom, dosages)
join public.pharma_ref_molecules m on lower(m.dci) = lower(s.dci)
on conflict (molecule_id, (lower(nom))) do nothing;
