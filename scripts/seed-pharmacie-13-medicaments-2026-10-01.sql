-- 13 médicaments courants supplémentaires (nouvelles classes, molécules,
-- spécialités et dosages). Spécialités et dosages vérifiés dans la base publique
-- des médicaments (base-donnees-publique.medicaments.gouv.fr). Rejouable sans doublon.
-- Retour arrière : seed-pharmacie-13-medicaments-2026-10-01-revert.sql.

-- 1. Sous-classes (parents déjà existants)
insert into public.pharma_ref_classes (nom, parent_id)
select v.nom, p.id
from (values
  ('Inhibiteurs des alpha-glucosidases', 'Antidiabétiques'),
  ('Corticoïdes inhalés', 'Antiasthmatiques'),
  ('Benzamides', 'Antipsychotiques'),
  ('Antidépresseurs multimodaux', 'Antidépresseurs'),
  ('Sevrage tabagique', 'Psychiatrie')
) as v(nom, parent)
join public.pharma_ref_classes p on lower(p.nom) = lower(v.parent)
on conflict ((lower(nom))) do nothing;

-- 2. Molécules
insert into public.pharma_ref_molecules (dci, classe_id)
select v.dci, c.id
from (values
  ('nicardipine', 'Inhibiteurs calciques'),
  ('acébutolol', 'Bêtabloquants'),
  ('fluvastatine', 'Statines'),
  ('acarbose', 'Inhibiteurs des alpha-glucosidases'),
  ('budésonide', 'Corticoïdes inhalés'),
  ('fluticasone + salmétérol', 'Associations CSI + LABA'),
  ('bilastine', 'Antihistaminiques H1'),
  ('tiapride', 'Benzamides'),
  ('zolmitriptan', 'Triptans'),
  ('vortioxétine', 'Antidépresseurs multimodaux'),
  ('bupropion', 'Sevrage tabagique'),
  ('palipéridone', 'Antipsychotiques atypiques'),
  ('céfixime', 'Céphalosporines')
) as v(dci, classe)
join public.pharma_ref_classes c on lower(c.nom) = lower(v.classe)
on conflict ((lower(dci))) do nothing;

-- Associations : composants renseignés
update public.pharma_ref_molecules
set association = true, composants = array['fluticasone', 'salmétérol']
where lower(dci) = 'fluticasone + salmétérol';

-- 3. Spécialités et dosages
insert into public.pharma_ref_specialites (molecule_id, nom, dosages)
select m.id, s.nom, s.dosages
from (values
  ('nicardipine', 'Loxen', '20 mg'),
  ('nicardipine', 'Loxen LP', '50 mg'),
  ('acébutolol', 'Sectral', '200 mg'),
  ('acébutolol', 'Sectral LP', '500 mg'),
  ('fluvastatine', 'Lescol LP', '80 mg'),
  ('acarbose', 'Glucor', '50 mg, 100 mg'),
  ('budésonide', 'Pulmicort', '0,5 mg/2 mL, 1 mg/2 mL (nébuliseur)'),
  ('fluticasone + salmétérol', 'Seretide Diskus', '100/50 µg/dose, 250/50 µg/dose, 500/50 µg/dose'),
  ('bilastine', 'Inorial', '10 mg (orodispersible), 20 mg'),
  ('tiapride', 'Tiapridal', '100 mg (comprimé), 100 mg/2 mL (injectable)'),
  ('vortioxétine', 'Brintellix', '5 mg, 10 mg, 15 mg, 20 mg'),
  ('bupropion', 'Zyban LP', '150 mg'),
  ('palipéridone', 'Xeplion', '25 mg, 50 mg, 75 mg, 100 mg, 150 mg (injectable LP)'),
  ('céfixime', 'Oroken', '200 mg')
) as s(dci, nom, dosages)
join public.pharma_ref_molecules m on lower(m.dci) = lower(s.dci)
on conflict (molecule_id, (lower(nom))) do nothing;
