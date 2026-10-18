-- Module Opinions, extension Partis : partis, programmes datés par échéance et
-- propositions notées sur les 5 axes (même grille que opinions_idees : score
-- -2 à +2, null = axe non concerné), priorités personnelles par thème, et lien
-- optionnel d'une idée vers la proposition de parti dont elle est reprise.
-- Pas de user_id (app mono-utilisateur) ; RLS activée sans politique, comme les
-- autres tables (l'app passe par la clé service role).
--
-- Les propositions sont écrites une fois validées en lot (par le skill
-- kilio-opinions ou à la main dans l'app) : pas de statut. Elles ne portent ni
-- lien ni citation, seulement le programme (daté) dont elles viennent.

begin;

create table opinions_partis (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (length(btrim(nom)) > 0),
  sigle text not null default '',
  created_at timestamptz not null default now()
);

create unique index idx_opinions_partis_nom on opinions_partis (lower(nom));

create table opinions_programmes (
  id uuid primary key default gen_random_uuid(),
  parti_id uuid not null references opinions_partis(id) on delete cascade,
  -- Libellé libre : « Présidentielle 2027 », « Législatives 2024 »…
  echeance text not null check (length(btrim(echeance)) > 0),
  -- Date de publication ; sert à choisir le programme le plus récent.
  date_programme date,
  created_at timestamptz not null default now()
);

create index idx_opinions_programmes_parti
  on opinions_programmes(parti_id, date_programme desc nulls last, created_at desc);

create table opinions_propositions (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references opinions_programmes(id) on delete cascade,
  position text not null check (length(btrim(position)) > 0),
  theme text not null,
  score_economique smallint check (score_economique between -2 and 2),
  score_societal smallint check (score_societal between -2 and 2),
  score_autorite smallint check (score_autorite between -2 and 2),
  score_ecologie smallint check (score_ecologie between -2 and 2),
  score_identite smallint check (score_identite between -2 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_opinions_propositions_programme on opinions_propositions(programme_id);

-- Importance d'un thème pour moi : pondère la proximité avec les partis.
-- Un thème sans ligne vaut « normal ».
create table opinions_priorites (
  theme text primary key,
  niveau text not null check (niveau in ('secondaire', 'normal', 'prioritaire')),
  updated_at timestamptz not null default now()
);

-- Idée reprise d'une proposition de parti (la proposition peut disparaître).
alter table opinions_idees
  add column proposition_id uuid references opinions_propositions(id) on delete set null;

create index idx_opinions_idees_proposition on opinions_idees(proposition_id);

alter table opinions_partis enable row level security;
alter table opinions_programmes enable row level security;
alter table opinions_propositions enable row level security;
alter table opinions_priorites enable row level security;

commit;
