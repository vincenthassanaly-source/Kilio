-- Retour arrière de seed-pharmacie-43-medicaments-2026-10-01.sql.
-- Les spécialités partent avec leur molécule (cascade). Les molécules sont
-- supprimées avant les classes, puis les sous-classes avant les racines.

delete from public.pharma_ref_molecules
where lower(dci) in (
  'amlodipine + valsartan', 'périndopril + amlodipine', 'codéine + paracétamol',
  'tramadol + paracétamol', 'méloxicam', 'célécoxib', 'étoricoxib', 'dexaméthasone',
  'hydrocortisone', 'bétaméthasone', 'trimébutine', 'diosmectite',
  'acide ursodésoxycholique', 'bisacodyl', 'pancréatine', 'carbocistéine', 'loratadine',
  'mométasone', 'béclométasone', 'salmétérol', 'ceftriaxone', 'josamycine', 'nystatine',
  'mébendazole', 'ofloxacine', 'méthylphénidate', 'buspirone', 'étifoxine', 'agomélatine',
  'bétahistine', 'mélatonine', 'lévonorgestrel', 'désogestrel', 'progestérone',
  'fésotérodine', 'méthotrexate', 'azathioprine', 'fébuxostat', 'chlorure de potassium',
  'anastrozole', 'létrozole', 'tamoxifène', 'insuline lispro'
);

delete from public.pharma_ref_classes
where lower(nom) in (
  'associations antihypertensives', 'hépatobiliaire', 'enzymes pancréatiques',
  'mucolytiques', 'corticoïdes nasaux', 'bêta-2 mimétiques de longue durée',
  'antifongiques polyènes', 'psychostimulants', 'anxiolytiques non benzodiazépiniques',
  'antidépresseurs mélatoninergiques', 'agonistes mélatoninergiques', 'antivertigineux',
  'contraceptifs progestatifs', 'contraception d''urgence', 'progestatifs',
  'immunosuppresseurs', 'potassium', 'hormonothérapies anticancéreuses'
);

delete from public.pharma_ref_classes
where lower(nom) in ('pneumologie', 'gynécologie', 'immunologie', 'électrolytes', 'cancérologie');
