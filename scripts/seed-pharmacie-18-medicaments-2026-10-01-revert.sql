-- Retour arrière de seed-pharmacie-18-medicaments-2026-10-01.sql.
-- Les spécialités partent avec leur molécule (cascade). Les molécules sont
-- supprimées avant les classes.

delete from public.pharma_ref_molecules
where lower(dci) in (
  'métoprolol', 'digoxine', 'trinitrine', 'budésonide + formotérol', 'racécadotril',
  'dompéridone', 'fentanyl', 'gabapentine', 'rispéridone', 'ropinirole', 'duloxétine',
  'clonazépam', 'amoxicilline + acide clavulanique', 'nitrofurantoïne', 'lévofloxacine',
  'prednisone', 'carbimazole', 'acide folique'
);

delete from public.pharma_ref_classes
where lower(nom) in (
  'cardiotoniques', 'dérivés nitrés', 'agonistes dopaminergiques', 'antithyroïdiens de synthèse'
);
