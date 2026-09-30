-- Lien Habitudes <-> Objectifs.
--  * habitudes.frequence_hebdo : null = quotidienne ; 1..6 = "X fois par semaine".
--  * habitudes.archivee_le : date d'archivage, pour que l'habitude cesse de
--    compter dans un objectif à partir de ce jour (l'historique est conservé).
--  * type_suivi_objectif 'habitudes' : la progression vient des habitudes liées.
--  * objectif_habitudes : table de liaison N-N.
-- Pas de RLS ni de user_id (app mono-utilisateur, cf. migration-suppression-auth).

alter table habitudes
  add column frequence_hebdo smallint check (frequence_hebdo between 1 and 6),
  add column archivee_le date;

update habitudes set archivee_le = updated_at::date where actif = false and archivee_le is null;

alter type type_suivi_objectif add value if not exists 'habitudes';

create table objectif_habitudes (
  objectif_id uuid not null references objectifs(id) on delete cascade,
  habitude_id uuid not null references habitudes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (objectif_id, habitude_id)
);

create index idx_objectif_habitudes_habitude_id on objectif_habitudes(habitude_id);
