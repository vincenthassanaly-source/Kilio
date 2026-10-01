-- Retour arrière de seed-pharmacie-20-medicaments-ter-2026-10-01.sql.
-- Les spécialités partent avec leur molécule (cascade). Les molécules sont
-- supprimées avant les classes, puis les sous-classes avant les racines.

delete from public.pharma_ref_molecules
where lower(dci) in (
  'nébivolol', 'amiodarone', 'warfarine', 'sitagliptine', 'sémaglutide',
  'tiotropium', 'macrogol 4000', 'phloroglucinol', 'sumatriptan', 'lamotrigine',
  'mirtazapine', 'quétiapine', 'hydroxyzine', 'cefpodoxime', 'fosfomycine',
  'métronidazole', 'fluconazole', 'sildénafil', 'latanoprost', 'hydroxychloroquine'
);

delete from public.pharma_ref_classes
where lower(nom) in (
  'antiarythmiques', 'antivitamines k', 'inhibiteurs de la dpp-4', 'agonistes du glp-1',
  'anticholinergiques inhalés', 'laxatifs', 'antispasmodiques', 'triptans', 'nassa',
  'céphalosporines', 'antibiotiques urinaires', 'nitro-imidazolés', 'antifongiques azolés',
  'inhibiteurs de la pde5', 'antiglaucomateux', 'antipaludéens de synthèse'
);

delete from public.pharma_ref_classes
where lower(nom) in ('cardiologie', 'antifongiques', 'ophtalmologie');
