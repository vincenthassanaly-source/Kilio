-- Retour arrière de seed-pharmacie-20-medicaments-quater-2026-10-01.sql.
-- Les spécialités partent avec leur molécule (cascade). Les molécules sont
-- supprimées avant les classes, puis les sous-classes avant la racine.

delete from public.pharma_ref_molecules
where lower(dci) in (
  'enoxaparine', 'ticagrélor', 'fénofibrate', 'diltiazem', 'ivabradine', 'glimépiride',
  'liraglutide', 'desloratadine', 'métoclopramide', 'mésalazine', 'lactulose', 'naproxène',
  'oxycodone', 'lévétiracétam', 'olanzapine', 'lithium', 'clarithromycine',
  'sulfaméthoxazole + triméthoprime', 'aciclovir', 'terbinafine'
);

delete from public.pharma_ref_classes
where lower(nom) in (
  'héparines de bas poids moléculaire', 'fibrates', 'inhibiteurs du courant if',
  'anti-inflammatoires intestinaux', 'thymorégulateurs', 'sulfamides antibactériens',
  'antifongiques allylamines'
);

delete from public.pharma_ref_classes where lower(nom) = 'psychiatrie';
