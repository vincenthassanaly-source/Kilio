-- À appliquer APRÈS le déploiement du code qui retire le module Sport et la
-- bascule Repos / Entraînement : l'ancienne version de l'app lit encore ces
-- tables. Suppression DÉFINITIVE et sans export (décision du 2026-10-04).
--
-- 1. Module Sport : tables filles d'abord (séries, séances, routines), puis
--    la bibliothèque d'exercices. Les politiques, index et clés étrangères
--    partent avec les tables.
-- 2. Bucket de stockage sport-exercices : à VIDER d'abord par l'API Storage
--    (un DELETE direct sur storage.objects laisserait les fichiers
--    orphelins), puis à supprimer.
-- 3. journal_jours (type de jour mémorisé par date), remplacé par le planning
--    hebdomadaire nutrition_planning.
-- 4. objectifs_nutritionnels.jour_type passe de l'enum jour_type_ppl à du
--    texte contraint, puis l'enum (plus utilisé nulle part) est supprimé.
--
-- Pour tout rétablir, rejouer les anciennes migrations depuis l'historique
-- git (scripts/migration-sport-*.sql, migration-journal-jours-2026-09-25.sql) :
-- les DONNÉES supprimées, elles, ne se récupèrent pas.

drop table if exists sport_series;
drop table if exists sport_seances;
drop table if exists sport_routine_exercices;
drop table if exists sport_routines;
drop table if exists sport_exercices;

-- Une fois le bucket vidé par l'API Storage :
delete from storage.buckets where id = 'sport-exercices';

drop table if exists journal_jours;

alter table objectifs_nutritionnels
  alter column jour_type drop default,
  alter column jour_type type text using jour_type::text,
  alter column jour_type set default 'repos',
  add constraint objectifs_nutritionnels_jour_type_check check (jour_type in ('repos', 'entrainement'));

drop type if exists jour_type_ppl;
