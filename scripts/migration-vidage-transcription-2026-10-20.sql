-- « Vider ma tête » : transcription de la feuille en texte (API Gemini, à la demande).
--
-- `transcription` : le texte lu par Gemini, éventuellement corrigé à la main ;
-- null tant que la feuille n'a pas été transcrite. Il est effacé dès que les
-- traits de la feuille changent (voir enregistrerFeuille) et avec la feuille
-- (même ligne, donc supprimé par le delete de la feuille vide).
-- `transcription_modifiee` : vrai quand le texte a été corrigé à la main, pour
-- demander confirmation avant qu'une nouvelle transcription ne l'écrase.

alter table feuilles_vidage
  add column transcription text
    check (transcription is null or length(transcription) <= 50000),
  add column transcription_modifiee boolean not null default false;
