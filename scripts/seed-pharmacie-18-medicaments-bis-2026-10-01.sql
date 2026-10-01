-- 18 médicaments courants supplémentaires (nouvelle classe, molécules,
-- spécialités et dosages). Spécialités et dosages vérifiés dans la base publique
-- des médicaments (base-donnees-publique.medicaments.gouv.fr). Rejouable sans doublon.
-- Retour arrière : seed-pharmacie-18-medicaments-bis-2026-10-01-revert.sql.

-- 1. Sous-classe (parent déjà existant)
insert into public.pharma_ref_classes (nom, parent_id)
select v.nom, p.id
from (values
  ('Antituberculeux', 'Antibiotiques')
) as v(nom, parent)
join public.pharma_ref_classes p on lower(p.nom) = lower(v.parent)
on conflict ((lower(nom))) do nothing;

-- 2. Molécules
insert into public.pharma_ref_molecules (dci, classe_id)
select v.dci, c.id
from (values
  ('propranolol', 'Bêtabloquants'),
  ('trandolapril', 'IEC'),
  ('lercanidipine', 'Inhibiteurs calciques'),
  ('éplérénone', 'Antagonistes de l''aldostérone'),
  ('prasugrel', 'Antiagrégants plaquettaires'),
  ('glibenclamide', 'Sulfamides hypoglycémiants'),
  ('ipratropium', 'Anticholinergiques inhalés'),
  ('fexofénadine', 'Antihistaminiques H1'),
  ('lansoprazole', 'IPP'),
  ('kétoprofène', 'AINS'),
  ('buprénorphine', 'Antalgiques opioïdes'),
  ('oxcarbazépine', 'Antiépileptiques'),
  ('rizatriptan', 'Triptans'),
  ('clomipramine', 'Tricycliques'),
  ('clozapine', 'Antipsychotiques'),
  ('céfuroxime', 'Céphalosporines'),
  ('rifampicine', 'Antituberculeux'),
  ('albendazole', 'Anthelminthiques')
) as v(dci, classe)
join public.pharma_ref_classes c on lower(c.nom) = lower(v.classe)
on conflict ((lower(dci))) do nothing;

-- 3. Spécialités et dosages
insert into public.pharma_ref_specialites (molecule_id, nom, dosages)
select m.id, s.nom, s.dosages
from (values
  ('propranolol', 'Avlocardyl', '40 mg'),
  ('trandolapril', 'Odrik', '0,5 mg, 2 mg, 4 mg'),
  ('lercanidipine', 'Lercan', '10 mg, 20 mg'),
  ('éplérénone', 'Inspra', '25 mg, 50 mg'),
  ('prasugrel', 'Efient', '10 mg'),
  ('glibenclamide', 'Hémi-Daonil', '2,5 mg'),
  ('ipratropium', 'Atrovent', '0,5 mg/2 mL (adultes), 0,25 mg/1 mL (enfants) (nébuliseur)'),
  ('fexofénadine', 'Telfast', '180 mg'),
  ('lansoprazole', 'Ogast', '15 mg, 30 mg'),
  ('kétoprofène', 'Profénid', '50 mg (gélule), 100 mg (comprimé)'),
  ('kétoprofène', 'Bi-Profénid LP', '100 mg'),
  ('buprénorphine', 'Subutex', '0,4 mg, 2 mg, 8 mg'),
  ('buprénorphine', 'Temgesic', '0,2 mg (sublingual)'),
  ('oxcarbazépine', 'Trileptal', '150 mg, 300 mg, 600 mg'),
  ('rizatriptan', 'Maxalt', '10 mg'),
  ('rizatriptan', 'Maxaltlyo', '10 mg (lyophilisat)'),
  ('clomipramine', 'Anafranil', '10 mg, 25 mg, 75 mg'),
  ('clozapine', 'Leponex', '25 mg, 100 mg'),
  ('céfuroxime', 'Zinnat', '125 mg, 250 mg'),
  ('rifampicine', 'Rifadine', '300 mg'),
  ('rifampicine', 'Rimactan', '300 mg'),
  ('albendazole', 'Zentel', '400 mg')
) as s(dci, nom, dosages)
join public.pharma_ref_molecules m on lower(m.dci) = lower(s.dci)
on conflict (molecule_id, (lower(nom))) do nothing;
