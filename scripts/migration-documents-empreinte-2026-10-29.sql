-- Documents : détection des doublons lors du tri du vrac.
--
-- `document_fichiers.empreinte` : empreinte SHA-256 (hexadécimale, 64
-- caractères) du fichier tel qu'il est stocké. Calculée par l'action
-- `analyserDocumentVrac` quand le tri télécharge le fichier, et complétée au
-- besoin pour les fichiers déjà stockés (documents classés) au premier tri.
-- Null tant qu'elle n'a pas été calculée : aucune donnée existante n'est
-- modifiée. Deux fichiers de même empreinte sont strictement identiques.
--
-- Sans cette colonne, le tri fonctionne comme avant et ne détecte les doublons
-- que par le titre proposé.

alter table document_fichiers
  add column empreinte text;

create index document_fichiers_empreinte_idx on document_fichiers (empreinte)
  where empreinte is not null;
