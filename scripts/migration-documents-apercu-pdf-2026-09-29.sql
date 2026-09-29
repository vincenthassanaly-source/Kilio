-- Aperçu des PDF dans Documents : l'image (JPEG de la 1re page) est générée
-- côté client à l'ajout (pdf.js), stockée dans le bucket `documents-fichiers`
-- à côté du PDF, et référencée ici. Colonne facultative : un PDF sans aperçu
-- (ajouté avant cette migration, ou rendu impossible) garde l'icône PDF, et
-- l'aperçu manquant est généré à la volée à l'affichage de la liste.

alter table document_fichiers
  add column apercu_url text null;
