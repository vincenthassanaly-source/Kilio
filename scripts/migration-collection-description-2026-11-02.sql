-- Collection : description d'un élément, proposée par Gemini puis validée à la main.
--
-- `description` : une à deux phrases sur ce que montre la photo ou la vidéo ;
-- null tant que l'élément n'a pas été décrit. Elle sert de contexte aux
-- prochaines fonctions Gemini de la collection (rangement, regroupements).
-- Sans cette colonne, l'app fonctionne comme avant : le titrage se désactive.

alter table collection_items
  add column description text
    check (description is null or length(description) <= 600);
