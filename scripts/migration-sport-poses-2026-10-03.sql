-- Module Sport : illustrations dessinées des exercices.
--
-- Chaque exercice porte 2 poses (départ / arrivée) de 15 articulations dans un
-- repère 200 × 260 ; l'app les dessine et les anime en SVG (silhouette en
-- aplats) à la place des photos. Format : { "v": 1, "a": [[x, y] × 15], "b": [[x, y] × 15] }
-- (ordre des articulations : src/lib/sport/silhouette.ts).
--
-- Colonne nullable : sans poses, l'app retombe sur les photos (bucket
-- sport-exercices), qui restent en place. Remplie par
-- scripts/sport/poses/televerser-poses.mjs.
--
-- Additive et sans effet sur les lignes existantes ; revert : migration-sport-poses-2026-10-03-revert.sql.

ALTER TABLE public.sport_exercices
  ADD COLUMN IF NOT EXISTS poses jsonb;
