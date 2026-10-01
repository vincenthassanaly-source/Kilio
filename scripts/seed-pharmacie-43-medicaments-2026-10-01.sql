-- 43 médicaments courants supplémentaires (nouvelles classes, molécules,
-- spécialités et dosages). Spécialités et dosages vérifiés dans la base publique
-- des médicaments (base-donnees-publique.medicaments.gouv.fr). Rejouable sans doublon.
-- Retour arrière : seed-pharmacie-43-medicaments-2026-10-01-revert.sql.

-- 1. Classes racines
insert into public.pharma_ref_classes (nom)
values ('Pneumologie'), ('Gynécologie'), ('Immunologie'), ('Électrolytes'), ('Cancérologie')
on conflict ((lower(nom))) do nothing;

-- 2. Sous-classes (parents existants ou créés ci-dessus)
insert into public.pharma_ref_classes (nom, parent_id)
select v.nom, p.id
from (values
  ('Associations antihypertensives', 'Antihypertenseurs'),
  ('Hépatobiliaire', 'Gastro-entérologie'),
  ('Enzymes pancréatiques', 'Gastro-entérologie'),
  ('Mucolytiques', 'Pneumologie'),
  ('Corticoïdes nasaux', 'Antiallergiques'),
  ('Bêta-2 mimétiques de longue durée', 'Antiasthmatiques'),
  ('Antifongiques polyènes', 'Antifongiques'),
  ('Psychostimulants', 'Psychiatrie'),
  ('Anxiolytiques non benzodiazépiniques', 'Anxiolytiques'),
  ('Antidépresseurs mélatoninergiques', 'Antidépresseurs'),
  ('Agonistes mélatoninergiques', 'Hypnotiques'),
  ('Antivertigineux', 'Neurologie'),
  ('Contraceptifs progestatifs', 'Gynécologie'),
  ('Contraception d''urgence', 'Gynécologie'),
  ('Progestatifs', 'Gynécologie'),
  ('Immunosuppresseurs', 'Immunologie'),
  ('Potassium', 'Électrolytes'),
  ('Hormonothérapies anticancéreuses', 'Cancérologie')
) as v(nom, parent)
join public.pharma_ref_classes p on lower(p.nom) = lower(v.parent)
on conflict ((lower(nom))) do nothing;

-- 3. Molécules
insert into public.pharma_ref_molecules (dci, classe_id)
select v.dci, c.id
from (values
  ('amlodipine + valsartan', 'Associations antihypertensives'),
  ('périndopril + amlodipine', 'Associations antihypertensives'),
  ('codéine + paracétamol', 'Antalgiques opioïdes'),
  ('tramadol + paracétamol', 'Antalgiques opioïdes'),
  ('méloxicam', 'AINS'),
  ('célécoxib', 'AINS'),
  ('étoricoxib', 'AINS'),
  ('dexaméthasone', 'Corticoïdes'),
  ('hydrocortisone', 'Corticoïdes'),
  ('bétaméthasone', 'Corticoïdes'),
  ('trimébutine', 'Antispasmodiques'),
  ('diosmectite', 'Antidiarrhéiques'),
  ('acide ursodésoxycholique', 'Hépatobiliaire'),
  ('bisacodyl', 'Laxatifs'),
  ('pancréatine', 'Enzymes pancréatiques'),
  ('carbocistéine', 'Mucolytiques'),
  ('loratadine', 'Antihistaminiques H1'),
  ('mométasone', 'Corticoïdes nasaux'),
  ('béclométasone', 'Corticoïdes inhalés'),
  ('salmétérol', 'Bêta-2 mimétiques de longue durée'),
  ('ceftriaxone', 'Céphalosporines'),
  ('josamycine', 'Macrolides'),
  ('nystatine', 'Antifongiques polyènes'),
  ('mébendazole', 'Anthelminthiques'),
  ('ofloxacine', 'Fluoroquinolones'),
  ('méthylphénidate', 'Psychostimulants'),
  ('buspirone', 'Anxiolytiques non benzodiazépiniques'),
  ('étifoxine', 'Anxiolytiques non benzodiazépiniques'),
  ('agomélatine', 'Antidépresseurs mélatoninergiques'),
  ('bétahistine', 'Antivertigineux'),
  ('mélatonine', 'Agonistes mélatoninergiques'),
  ('lévonorgestrel', 'Contraception d''urgence'),
  ('désogestrel', 'Contraceptifs progestatifs'),
  ('progestérone', 'Progestatifs'),
  ('fésotérodine', 'Antimuscariniques urinaires'),
  ('méthotrexate', 'Immunosuppresseurs'),
  ('azathioprine', 'Immunosuppresseurs'),
  ('fébuxostat', 'Hypo-uricémiants'),
  ('chlorure de potassium', 'Potassium'),
  ('anastrozole', 'Hormonothérapies anticancéreuses'),
  ('létrozole', 'Hormonothérapies anticancéreuses'),
  ('tamoxifène', 'Hormonothérapies anticancéreuses'),
  ('insuline lispro', 'Insulines')
) as v(dci, classe)
join public.pharma_ref_classes c on lower(c.nom) = lower(v.classe)
on conflict ((lower(dci))) do nothing;

-- Associations : composants renseignés
update public.pharma_ref_molecules m
set association = true, composants = v.composants
from (values
  ('amlodipine + valsartan', array['amlodipine', 'valsartan']),
  ('périndopril + amlodipine', array['périndopril', 'amlodipine']),
  ('codéine + paracétamol', array['codéine', 'paracétamol']),
  ('tramadol + paracétamol', array['tramadol', 'paracétamol'])
) as v(dci, composants)
where lower(m.dci) = lower(v.dci);

-- 4. Spécialités et dosages
insert into public.pharma_ref_specialites (molecule_id, nom, dosages)
select m.id, s.nom, s.dosages
from (values
  ('amlodipine + valsartan', 'Exforge', '5 mg/80 mg, 5 mg/160 mg, 10 mg/160 mg'),
  ('périndopril + amlodipine', 'Coveram', '5 mg/5 mg, 5 mg/10 mg, 10 mg/5 mg'),
  ('codéine + paracétamol', 'Dafalgan Codéine', '500 mg/30 mg'),
  ('codéine + paracétamol', 'Klipal', '300 mg/25 mg, 600 mg/50 mg'),
  ('tramadol + paracétamol', 'Ixprim', '37,5 mg/325 mg (effervescent)'),
  ('tramadol + paracétamol', 'Zaldiar', '37,5 mg/325 mg'),
  ('méloxicam', 'Mobic', '7,5 mg, 15 mg'),
  ('célécoxib', 'Celebrex', '100 mg'),
  ('étoricoxib', 'Arcoxia', '30 mg, 60 mg'),
  ('dexaméthasone', 'Dectancyl', '0,5 mg'),
  ('hydrocortisone', 'Hydrocortisone Roussel', '10 mg'),
  ('bétaméthasone', 'Célestène', '0,05 % (gouttes buvables)'),
  ('bétaméthasone', 'Célestène Chronodose', '5,70 mg/mL (injectable)'),
  ('trimébutine', 'Débridat', '100 mg, 200 mg'),
  ('diosmectite', 'Smecta', '3 g (sachet)'),
  ('acide ursodésoxycholique', 'Délursan', '250 mg'),
  ('bisacodyl', 'Dulcolax', '5 mg'),
  ('pancréatine', 'Créon', '10 000 U, 25 000 U'),
  ('carbocistéine', 'Bronchokod Adultes', '5 % (solution buvable), 750 mg/10 mL (sachet)'),
  ('carbocistéine', 'Bronchokod Enfants', '2 % (sirop)'),
  ('loratadine', 'Clarityne', '10 mg'),
  ('mométasone', 'Nasonex', '50 µg/dose (spray nasal)'),
  ('béclométasone', 'Bécotide', '250 µg/dose'),
  ('béclométasone', 'Qvar Autohaler', '100 µg/dose'),
  ('béclométasone', 'Qvarspray', '100 µg/dose'),
  ('salmétérol', 'Serevent Diskus', '50 µg/dose'),
  ('ceftriaxone', 'Rocéphine', '500 mg/5 mL, 1 g/10 mL (injectable IV)'),
  ('josamycine', 'Josacine', '500 mg (comprimé), 1000 mg (comprimé dispersible), 125 mg/5 mL, 250 mg/5 mL, 500 mg/5 mL (suspension buvable)'),
  ('nystatine', 'Mycostatine', '100 000 UI/mL (suspension buvable)'),
  ('ofloxacine', 'Oflocet', '200 mg'),
  ('méthylphénidate', 'Ritaline', '10 mg'),
  ('méthylphénidate', 'Ritaline LP', '10 mg, 20 mg'),
  ('méthylphénidate', 'Concerta LP', '18 mg, 36 mg, 54 mg'),
  ('étifoxine', 'Stresam', '50 mg'),
  ('agomélatine', 'Valdoxan', '25 mg'),
  ('bétahistine', 'Betaserc', '24 mg'),
  ('mélatonine', 'Circadin', '2 mg (LP)'),
  ('mélatonine', 'Adaflex', '2 mg, 5 mg'),
  ('lévonorgestrel', 'Norlevo', '1,5 mg'),
  ('désogestrel', 'Cerazette', '75 µg'),
  ('progestérone', 'Utrogestan', '100 mg, 200 mg, 400 mg (voie vaginale)'),
  ('fésotérodine', 'Toviaz', '4 mg'),
  ('méthotrexate', 'Novatrex', '2,5 mg'),
  ('méthotrexate', 'Imeth', '2,5 mg, 10 mg'),
  ('azathioprine', 'Imurel', '25 mg, 50 mg'),
  ('fébuxostat', 'Adenuric', '80 mg, 120 mg'),
  ('chlorure de potassium', 'Diffu-K', '600 mg'),
  ('anastrozole', 'Arimidex', '1 mg'),
  ('létrozole', 'Femara', '2,5 mg'),
  ('tamoxifène', 'Nolvadex', '20 mg'),
  ('insuline lispro', 'Humalog', '100 UI/mL (flacon, cartouche, KwikPen), 200 UI/mL (KwikPen)')
) as s(dci, nom, dosages)
join public.pharma_ref_molecules m on lower(m.dci) = lower(s.dci)
on conflict (molecule_id, (lower(nom))) do nothing;
