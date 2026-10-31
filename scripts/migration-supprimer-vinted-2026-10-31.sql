-- Suppression du module Vinted : tables, puis bucket de photos.
-- (Création d'origine : migration-vinted-2026-10-17.sql.)
-- Au moment de l'application : 0 annonce, 0 photo, 0 objet Storage, et la
-- seule ligne de vinted_reglages était celle par défaut.

begin;

drop table if exists vinted_photos;
drop table if exists vinted_annonces;
drop table if exists vinted_reglages;

-- Le bucket est vide : on le retire par la table (la purge d'objets éventuels
-- passerait par l'API Storage, pas par SQL).
delete from storage.buckets where id = 'vinted-images';

commit;
