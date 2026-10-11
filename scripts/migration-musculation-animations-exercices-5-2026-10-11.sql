-- Associe l'animation de la marche à l'exercice « Marche »
-- (public/animations/musculation/marche.webm, clé dans
-- src/lib/musculation/animations.ts). Rapprochement par le nom.

update public.exercices
set animation = 'marche'
where lower(btrim(nom)) = 'marche';
