-- Module Opinions, Partis : suivi de lecture des propositions.
-- `lu` : la proposition a été lue (case cochée à la main, jamais automatique).
-- `favori` : étoile « à relire / à garder », indépendante de `lu`.
-- Sur la ligne de la proposition : app mono-utilisateur, suppression en cascade
-- avec la proposition ou son programme, aucune table supplémentaire.

begin;

alter table opinions_propositions
  add column lu boolean not null default false,
  add column favori boolean not null default false;

commit;
