-- Retour arrière de seed-pharmacie-19-medicaments-2026-10-01.sql.
-- Les spécialités partent avec leur molécule (cascade). Les molécules sont
-- supprimées avant les classes, puis les sous-classes avant la racine.

delete from public.pharma_ref_molecules
where lower(dci) in (
  'vérapamil', 'carvédilol', 'énalapril', 'dabigatran', 'fluindione', 'alprazolam',
  'lorazépam', 'citalopram', 'topiramate', 'valproate de sodium', 'mémantine', 'baclofène',
  'pristinamycine', 'oseltamivir', 'ivermectine', 'solifénacine', 'alfuzosine',
  'mébévérine', 'tadalafil'
);

delete from public.pharma_ref_classes
where lower(nom) in (
  'antagonistes des récepteurs nmda', 'myorelaxants', 'synergistines', 'antigrippaux',
  'anthelminthiques', 'antimuscariniques urinaires'
);

delete from public.pharma_ref_classes where lower(nom) = 'antiparasitaires';
