-- Retour arrière de seed-pharmacie-20-medicaments-bis-2026-10-01.sql.
-- Les spécialités partent avec leur molécule (cascade). Les molécules sont
-- supprimées avant les classes, puis les sous-classes avant les racines.

delete from public.pharma_ref_molecules
where lower(dci) in (
  'clopidogrel', 'rivaroxaban', 'ézétimibe', 'gliclazide', 'escitalopram',
  'diclofénac', 'morphine', 'doxycycline', 'ciprofloxacine', 'valaciclovir',
  'montélukast', 'lopéramide', 'ondansétron', 'prégabaline', 'donépézil',
  'aripiprazole', 'acide alendronique', 'sulfate ferreux', 'colchicine', 'finastéride'
);

delete from public.pharma_ref_classes
where lower(nom) in (
  'inhibiteurs de l''absorption du cholestérol', 'sulfamides hypoglycémiants', 'cyclines',
  'fluoroquinolones', 'antiherpétiques', 'antileucotriènes', 'antidiarrhéiques', 'antiémétiques',
  'antiépileptiques', 'anticholinestérasiques', 'antipsychotiques atypiques', 'bisphosphonates',
  'antianémiques', 'traitement de la crise de goutte', 'inhibiteurs de la 5-alpha-réductase'
);

delete from public.pharma_ref_classes
where lower(nom) in ('antiviraux', 'gastro-entérologie', 'neurologie', 'rhumatologie', 'hématologie');
