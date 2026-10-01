-- 20 autres médicaments courants (nouvelles classes, molécules, spécialités et
-- dosages). Spécialités et dosages vérifiés dans la base publique des médicaments
-- (base-donnees-publique.medicaments.gouv.fr). Rejouable sans doublon.
-- Retour arrière : seed-pharmacie-20-medicaments-bis-2026-10-01-revert.sql.

-- 1. Classes racines
insert into public.pharma_ref_classes (nom)
values ('Antiviraux'), ('Gastro-entérologie'), ('Neurologie'), ('Rhumatologie'), ('Hématologie')
on conflict ((lower(nom))) do nothing;

-- 2. Sous-classes (parent existant ou créé ci-dessus)
insert into public.pharma_ref_classes (nom, parent_id)
select v.nom, p.id
from (values
  ('Inhibiteurs de l''absorption du cholestérol', 'Hypolipémiants'),
  ('Sulfamides hypoglycémiants', 'Antidiabétiques'),
  ('Cyclines', 'Antibiotiques'),
  ('Fluoroquinolones', 'Antibiotiques'),
  ('Antiherpétiques', 'Antiviraux'),
  ('Antileucotriènes', 'Antiasthmatiques'),
  ('Antidiarrhéiques', 'Gastro-entérologie'),
  ('Antiémétiques', 'Gastro-entérologie'),
  ('Antiépileptiques', 'Neurologie'),
  ('Anticholinestérasiques', 'Neurologie'),
  ('Antipsychotiques atypiques', 'Antipsychotiques'),
  ('Bisphosphonates', 'Rhumatologie'),
  ('Antianémiques', 'Hématologie'),
  ('Traitement de la crise de goutte', 'Antigoutteux'),
  ('Inhibiteurs de la 5-alpha-réductase', 'Urologie')
) as v(nom, parent)
join public.pharma_ref_classes p on lower(p.nom) = lower(v.parent)
on conflict ((lower(nom))) do nothing;

-- 3. Molécules
insert into public.pharma_ref_molecules (dci, classe_id)
select v.dci, c.id
from (values
  ('clopidogrel', 'Antiagrégants plaquettaires'),
  ('rivaroxaban', 'Anticoagulants oraux directs'),
  ('ézétimibe', 'Inhibiteurs de l''absorption du cholestérol'),
  ('gliclazide', 'Sulfamides hypoglycémiants'),
  ('escitalopram', 'ISRS'),
  ('diclofénac', 'AINS'),
  ('morphine', 'Antalgiques opioïdes'),
  ('doxycycline', 'Cyclines'),
  ('ciprofloxacine', 'Fluoroquinolones'),
  ('valaciclovir', 'Antiherpétiques'),
  ('montélukast', 'Antileucotriènes'),
  ('lopéramide', 'Antidiarrhéiques'),
  ('ondansétron', 'Antiémétiques'),
  ('prégabaline', 'Antiépileptiques'),
  ('donépézil', 'Anticholinestérasiques'),
  ('aripiprazole', 'Antipsychotiques atypiques'),
  ('acide alendronique', 'Bisphosphonates'),
  ('sulfate ferreux', 'Antianémiques'),
  ('colchicine', 'Traitement de la crise de goutte'),
  ('finastéride', 'Inhibiteurs de la 5-alpha-réductase')
) as v(dci, classe)
join public.pharma_ref_classes c on lower(c.nom) = lower(v.classe)
on conflict ((lower(dci))) do nothing;

-- 4. Spécialités et dosages
insert into public.pharma_ref_specialites (molecule_id, nom, dosages)
select m.id, s.nom, s.dosages
from (values
  ('clopidogrel', 'Plavix', '75 mg, 300 mg'),
  ('rivaroxaban', 'Xarelto', '2,5 mg, 10 mg, 15 mg, 20 mg'),
  ('ézétimibe', 'Ezetrol', '10 mg'),
  ('gliclazide', 'Diamicron', '30 mg LM, 60 mg LM'),
  ('escitalopram', 'Seroplex', '5 mg, 10 mg, 15 mg, 20 mg'),
  ('diclofénac', 'Voltarène', '50 mg'),
  ('diclofénac', 'Voltarène LP', '75 mg, 100 mg'),
  ('morphine', 'Skenan LP', '10 mg, 30 mg, 60 mg, 100 mg, 200 mg'),
  ('doxycycline', 'Doxy', '100 mg'),
  ('ciprofloxacine', 'Ciflox', '250 mg, 500 mg, 750 mg'),
  ('valaciclovir', 'Zelitrex', '500 mg'),
  ('montélukast', 'Singulair', '5 mg (à croquer), 10 mg'),
  ('lopéramide', 'Imodiumcaps', '2 mg'),
  ('ondansétron', 'Zophren', '4 mg, 8 mg'),
  ('prégabaline', 'Lyrica', '25 mg, 50 mg, 75 mg, 100 mg, 150 mg, 200 mg, 300 mg'),
  ('donépézil', 'Aricept', '5 mg, 10 mg'),
  ('aripiprazole', 'Abilify', '5 mg, 10 mg, 15 mg'),
  ('acide alendronique', 'Fosamax', '10 mg, 70 mg'),
  ('sulfate ferreux', 'Tardyferon', '80 mg'),
  ('colchicine', 'Colchicine Opocalcium', '1 mg'),
  ('finastéride', 'Chibro-Proscar', '5 mg')
) as s(dci, nom, dosages)
join public.pharma_ref_molecules m on lower(m.dci) = lower(s.dci)
on conflict (molecule_id, (lower(nom))) do nothing;
