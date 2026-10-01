-- Retour arrière de seed-pharmacie-20-medicaments-2026-10-01.sql.
-- Les spécialités partent avec leur molécule (cascade). Les molécules sont
-- supprimées avant les classes, puis les sous-classes avant les racines.

delete from public.pharma_ref_molecules
where lower(dci) in (
  'amlodipine', 'bisoprolol', 'spironolactone', 'apixaban', 'acide acétylsalicylique',
  'rosuvastatine', 'metformine', 'empagliflozine', 'ibuprofène', 'tramadol',
  'amoxicilline', 'azithromycine', 'salbutamol', 'cétirizine', 'prednisolone',
  'lévothyroxine', 'sertraline', 'bromazépam', 'tamsulosine', 'allopurinol'
);

delete from public.pharma_ref_classes
where lower(nom) in (
  'bêtabloquants', 'antagonistes de l''aldostérone', 'anticoagulants oraux directs',
  'antiagrégants plaquettaires', 'biguanides', 'ains', 'corticoïdes', 'antalgiques opioïdes',
  'pénicillines', 'macrolides', 'bêta-2 mimétiques de courte durée', 'antihistaminiques h1',
  'hormones thyroïdiennes', 'alpha-bloquants', 'hypo-uricémiants'
);

delete from public.pharma_ref_classes
where lower(nom) in (
  'antithrombotiques', 'anti-inflammatoires', 'antibiotiques', 'antiallergiques',
  'thyroïde', 'urologie', 'antigoutteux'
);
