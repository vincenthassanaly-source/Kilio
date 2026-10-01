-- Retour arrière de seed-pharmacie-19-medicaments-bis-2026-10-01.sql.
-- Les spécialités partent avec leur molécule (cascade). Les molécules sont
-- supprimées avant les classes.

delete from public.pharma_ref_molecules
where lower(dci) in (
  'aténolol', 'lisinopril', 'nifédipine', 'flécaïnide', 'répaglinide', 'vildagliptine',
  'lévocétirizine', 'terbutaline', 'dutastéride', 'oxybutynine', 'carbamazépine',
  'lacosamide', 'pramipexole', 'diazépam', 'halopéridol', 'clindamycine', 'spiramycine',
  'méthylprednisolone', 'acide tranexamique'
);

delete from public.pharma_ref_classes
where lower(nom) in ('glinides', 'butyrophénones', 'lincosamides', 'antifibrinolytiques');
