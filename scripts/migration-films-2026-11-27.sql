-- Module Films : liste de films à voir / vus (instantané TMDB du film) et
-- plateformes de streaming (abonnements) choisies pour filtrer les résultats.
-- Pas de user_id (app mono-utilisateur) ; RLS activée sans politique, comme les
-- autres tables (l'app passe par la clé service role).
--
-- Les disponibilités par plateforme ne sont PAS stockées : elles sont lues en
-- direct sur TMDB (données JustWatch) et mises en cache côté serveur.

begin;

create table films_watchlist (
  tmdb_id integer primary key,
  titre text not null check (length(btrim(titre)) > 0),
  annee smallint,
  affiche text,
  statut text not null default 'a_voir' check (statut in ('a_voir', 'vu')),
  vu_le timestamptz,
  created_at timestamptz not null default now()
);

create index idx_films_watchlist_statut on films_watchlist(statut, created_at desc);

create table films_plateformes (
  fournisseur_id integer primary key,
  nom text not null check (length(btrim(nom)) > 0),
  logo text,
  created_at timestamptz not null default now()
);

alter table films_watchlist enable row level security;
alter table films_plateformes enable row level security;

commit;
