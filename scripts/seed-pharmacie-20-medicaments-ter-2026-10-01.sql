-- 20 médicaments courants supplémentaires (nouvelles classes, molécules,
-- spécialités et dosages). Spécialités et dosages vérifiés dans la base publique
-- des médicaments (base-donnees-publique.medicaments.gouv.fr). Rejouable sans doublon.
-- Retour arrière : seed-pharmacie-20-medicaments-ter-2026-10-01-revert.sql.

-- 1. Classes racines
insert into public.pharma_ref_classes (nom)
values ('Cardiologie'), ('Antifongiques'), ('Ophtalmologie')
on conflict ((lower(nom))) do nothing;

-- 2. Sous-classes (parent existant ou créé ci-dessus)
insert into public.pharma_ref_classes (nom, parent_id)
select v.nom, p.id
from (values
  ('Antiarythmiques', 'Cardiologie'),
  ('Antivitamines K', 'Antithrombotiques'),
  ('Inhibiteurs de la DPP-4', 'Antidiabétiques'),
  ('Agonistes du GLP-1', 'Antidiabétiques'),
  ('Anticholinergiques inhalés', 'Antiasthmatiques'),
  ('Laxatifs', 'Gastro-entérologie'),
  ('Antispasmodiques', 'Gastro-entérologie'),
  ('Triptans', 'Neurologie'),
  ('NaSSA', 'Antidépresseurs'),
  ('Céphalosporines', 'Antibiotiques'),
  ('Antibiotiques urinaires', 'Antibiotiques'),
  ('Nitro-imidazolés', 'Antibiotiques'),
  ('Antifongiques azolés', 'Antifongiques'),
  ('Inhibiteurs de la PDE5', 'Urologie'),
  ('Antiglaucomateux', 'Ophtalmologie'),
  ('Antipaludéens de synthèse', 'Rhumatologie')
) as v(nom, parent)
join public.pharma_ref_classes p on lower(p.nom) = lower(v.parent)
on conflict ((lower(nom))) do nothing;

-- 3. Molécules
insert into public.pharma_ref_molecules (dci, classe_id)
select v.dci, c.id
from (values
  ('nébivolol', 'Bêtabloquants'),
  ('amiodarone', 'Antiarythmiques'),
  ('warfarine', 'Antivitamines K'),
  ('sitagliptine', 'Inhibiteurs de la DPP-4'),
  ('sémaglutide', 'Agonistes du GLP-1'),
  ('tiotropium', 'Anticholinergiques inhalés'),
  ('macrogol 4000', 'Laxatifs'),
  ('phloroglucinol', 'Antispasmodiques'),
  ('sumatriptan', 'Triptans'),
  ('lamotrigine', 'Antiépileptiques'),
  ('mirtazapine', 'NaSSA'),
  ('quétiapine', 'Antipsychotiques atypiques'),
  ('hydroxyzine', 'Antihistaminiques H1'),
  ('cefpodoxime', 'Céphalosporines'),
  ('fosfomycine', 'Antibiotiques urinaires'),
  ('métronidazole', 'Nitro-imidazolés'),
  ('fluconazole', 'Antifongiques azolés'),
  ('sildénafil', 'Inhibiteurs de la PDE5'),
  ('latanoprost', 'Antiglaucomateux'),
  ('hydroxychloroquine', 'Antipaludéens de synthèse')
) as v(dci, classe)
join public.pharma_ref_classes c on lower(c.nom) = lower(v.classe)
on conflict ((lower(dci))) do nothing;

-- 4. Spécialités et dosages
insert into public.pharma_ref_specialites (molecule_id, nom, dosages)
select m.id, s.nom, s.dosages
from (values
  ('nébivolol', 'Temerit', '5 mg'),
  ('amiodarone', 'Cordarone', '200 mg'),
  ('warfarine', 'Coumadine', '2 mg, 5 mg'),
  ('sitagliptine', 'Januvia', '50 mg, 100 mg'),
  ('sémaglutide', 'Ozempic', '0,25 mg, 0,5 mg, 1 mg (stylo)'),
  ('tiotropium', 'Spiriva', '18 µg (gélule HandiHaler)'),
  ('tiotropium', 'Spiriva Respimat', '2,5 µg/dose'),
  ('macrogol 4000', 'Forlax', '4 g, 10 g'),
  ('phloroglucinol', 'Spasfon Lyoc', '80 mg'),
  ('sumatriptan', 'Imigrane', '50 mg (comprimé), 10 mg et 20 mg (spray nasal)'),
  ('lamotrigine', 'Lamictal', '2 mg, 5 mg, 25 mg, 50 mg, 100 mg, 200 mg'),
  ('mirtazapine', 'Norset', '15 mg'),
  ('quétiapine', 'Xeroquel LP', '50 mg, 300 mg, 400 mg'),
  ('hydroxyzine', 'Atarax', '25 mg'),
  ('cefpodoxime', 'Orelox', '100 mg'),
  ('fosfomycine', 'Monuril', '3 g'),
  ('métronidazole', 'Flagyl', '250 mg, 500 mg'),
  ('fluconazole', 'Triflucan', '50 mg, 100 mg, 200 mg'),
  ('sildénafil', 'Viagra', '25 mg, 50 mg, 100 mg'),
  ('latanoprost', 'Xalatan', '50 µg/mL'),
  ('hydroxychloroquine', 'Plaquenil', '200 mg')
) as s(dci, nom, dosages)
join public.pharma_ref_molecules m on lower(m.dci) = lower(s.dci)
on conflict (molecule_id, (lower(nom))) do nothing;
