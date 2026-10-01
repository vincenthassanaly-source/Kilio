-- Ajout des pathologies hypertension et diabète (types 1 et 2) au référentiel
-- Pharmacie. Noms seulement : aucun protocole pour l'instant.
-- Rejouable sans doublon. Retour arrière : seed-pharmacie-pathologies-2026-10-01-revert.sql.

insert into public.pharma_ref_pathologies (nom) values
  ('Diabète de type 1'),
  ('Diabète de type 2'),
  ('Hypertension')
on conflict ((lower(nom))) do nothing;
