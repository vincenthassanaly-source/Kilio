-- Retour arrière de seed-pharmacie-13-medicaments-2026-10-01.sql.
-- Les spécialités partent avec leur molécule (cascade). Les molécules sont
-- supprimées avant les classes.

delete from public.pharma_ref_molecules
where lower(dci) in (
  'nicardipine', 'acébutolol', 'fluvastatine', 'acarbose', 'budésonide',
  'fluticasone + salmétérol', 'bilastine', 'tiapride', 'zolmitriptan',
  'vortioxétine', 'bupropion', 'palipéridone', 'céfixime'
);

delete from public.pharma_ref_classes
where lower(nom) in (
  'inhibiteurs des alpha-glucosidases', 'corticoïdes inhalés', 'benzamides',
  'antidépresseurs multimodaux', 'sevrage tabagique'
);
