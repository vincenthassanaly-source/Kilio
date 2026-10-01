-- 20 médicaments courants (nouvelles classes, molécules, spécialités et dosages).
-- Spécialités et dosages vérifiés dans la base publique des médicaments
-- (base-donnees-publique.medicaments.gouv.fr). Rejouable sans doublon.
-- Retour arrière : seed-pharmacie-20-medicaments-2026-10-01-revert.sql.

-- 1. Classes racines
insert into public.pharma_ref_classes (nom)
values ('Antithrombotiques'), ('Anti-inflammatoires'), ('Antibiotiques'),
       ('Antiallergiques'), ('Thyroïde'), ('Urologie'), ('Antigoutteux')
on conflict ((lower(nom))) do nothing;

-- 2. Sous-classes (parent existant ou créé ci-dessus)
insert into public.pharma_ref_classes (nom, parent_id)
select v.nom, p.id
from (values
  ('Bêtabloquants', 'Antihypertenseurs'),
  ('Antagonistes de l''aldostérone', 'Diurétiques'),
  ('Anticoagulants oraux directs', 'Antithrombotiques'),
  ('Antiagrégants plaquettaires', 'Antithrombotiques'),
  ('Biguanides', 'Antidiabétiques'),
  ('AINS', 'Anti-inflammatoires'),
  ('Corticoïdes', 'Anti-inflammatoires'),
  ('Antalgiques opioïdes', 'Antalgiques'),
  ('Pénicillines', 'Antibiotiques'),
  ('Macrolides', 'Antibiotiques'),
  ('Bêta-2 mimétiques de courte durée', 'Antiasthmatiques'),
  ('Antihistaminiques H1', 'Antiallergiques'),
  ('Hormones thyroïdiennes', 'Thyroïde'),
  ('Alpha-bloquants', 'Urologie'),
  ('Hypo-uricémiants', 'Antigoutteux')
) as v(nom, parent)
join public.pharma_ref_classes p on lower(p.nom) = lower(v.parent)
on conflict ((lower(nom))) do nothing;

-- 3. Molécules
insert into public.pharma_ref_molecules (dci, classe_id)
select v.dci, c.id
from (values
  ('amlodipine', 'Inhibiteurs calciques'),
  ('bisoprolol', 'Bêtabloquants'),
  ('spironolactone', 'Antagonistes de l''aldostérone'),
  ('apixaban', 'Anticoagulants oraux directs'),
  ('acide acétylsalicylique', 'Antiagrégants plaquettaires'),
  ('rosuvastatine', 'Statines'),
  ('metformine', 'Biguanides'),
  ('empagliflozine', 'Inhibiteurs du SGLT2'),
  ('ibuprofène', 'AINS'),
  ('tramadol', 'Antalgiques opioïdes'),
  ('amoxicilline', 'Pénicillines'),
  ('azithromycine', 'Macrolides'),
  ('salbutamol', 'Bêta-2 mimétiques de courte durée'),
  ('cétirizine', 'Antihistaminiques H1'),
  ('prednisolone', 'Corticoïdes'),
  ('lévothyroxine', 'Hormones thyroïdiennes'),
  ('sertraline', 'ISRS'),
  ('bromazépam', 'Benzodiazépines'),
  ('tamsulosine', 'Alpha-bloquants'),
  ('allopurinol', 'Hypo-uricémiants')
) as v(dci, classe)
join public.pharma_ref_classes c on lower(c.nom) = lower(v.classe)
on conflict ((lower(dci))) do nothing;

-- 4. Spécialités et dosages
insert into public.pharma_ref_specialites (molecule_id, nom, dosages)
select m.id, s.nom, s.dosages
from (values
  ('amlodipine', 'Amlor', '5 mg, 10 mg'),
  ('bisoprolol', 'Cardensiel', '1,25 mg, 2,5 mg, 3,75 mg, 5 mg, 7,5 mg, 10 mg'),
  ('spironolactone', 'Aldactone', '25 mg, 50 mg, 75 mg'),
  ('apixaban', 'Eliquis', '2,5 mg, 5 mg'),
  ('acide acétylsalicylique', 'Kardégic', '75 mg, 160 mg, 300 mg'),
  ('rosuvastatine', 'Crestor', '5 mg, 10 mg, 20 mg'),
  ('metformine', 'Glucophage', '500 mg, 850 mg, 1000 mg'),
  ('empagliflozine', 'Jardiance', '10 mg, 25 mg'),
  ('ibuprofène', 'Advil', '200 mg, 400 mg'),
  ('tramadol', 'Contramal', '50 mg'),
  ('tramadol', 'Contramal LP', '100 mg, 150 mg, 200 mg'),
  ('amoxicilline', 'Clamoxyl', '500 mg, 1 g, 250 mg/5 mL, 500 mg/5 mL'),
  ('azithromycine', 'Zithromax', '250 mg'),
  ('salbutamol', 'Ventoline', '100 µg/dose, 2,5 mg/2,5 mL, 5 mg/2,5 mL'),
  ('cétirizine', 'Zyrtec', '10 mg'),
  ('prednisolone', 'Solupred', '5 mg, 20 mg'),
  ('lévothyroxine', 'Levothyrox', '25, 38, 50, 63, 75, 88, 100, 112, 125, 137, 150, 175, 200 µg'),
  ('sertraline', 'Zoloft', '25 mg, 50 mg'),
  ('bromazépam', 'Lexomil', '6 mg'),
  ('tamsulosine', 'Josir LP', '0,4 mg'),
  ('allopurinol', 'Zyloric', '100 mg, 200 mg, 300 mg')
) as s(dci, nom, dosages)
join public.pharma_ref_molecules m on lower(m.dci) = lower(s.dci)
on conflict (molecule_id, (lower(nom))) do nothing;
