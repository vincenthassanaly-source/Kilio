-- Retour arrière de seed-pharmacie-18-medicaments-bis-2026-10-01.sql.
-- Les spécialités partent avec leur molécule (cascade). Les molécules sont
-- supprimées avant la classe.

delete from public.pharma_ref_molecules
where lower(dci) in (
  'propranolol', 'trandolapril', 'lercanidipine', 'éplérénone', 'prasugrel',
  'glibenclamide', 'ipratropium', 'fexofénadine', 'lansoprazole', 'kétoprofène',
  'buprénorphine', 'oxcarbazépine', 'rizatriptan', 'clomipramine', 'clozapine',
  'céfuroxime', 'rifampicine', 'albendazole'
);

delete from public.pharma_ref_classes
where lower(nom) = 'antituberculeux';
