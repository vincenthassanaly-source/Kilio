-- Module Opinions : idées politiques (position, thème, conviction, arguments,
-- source) classées sur cinq axes (score -2 à +2, null = axe non concerné) et
-- leur historique de versions. Pas de user_id (app mono-utilisateur) ; RLS
-- activée sans politique, comme les autres tables (l'app passe par la clé
-- service role) ; versions supprimées en cascade avec l'idée.
--
-- Convention des scores : -2 = pôle de gauche de l'axe, +2 = pôle de droite
-- (voir AXES dans src/lib/opinions/types.ts).

begin;

create table opinions_idees (
  id uuid primary key default gen_random_uuid(),
  position text not null check (length(btrim(position)) > 0),
  theme text,
  conviction text not null default 'plutot'
    check (conviction in ('hesitant', 'plutot', 'certain')),
  arguments_pour text not null default '',
  arguments_contre text not null default '',
  source text not null default '',
  score_economique smallint check (score_economique between -2 and 2),
  score_societal smallint check (score_societal between -2 and 2),
  score_autorite smallint check (score_autorite between -2 and 2),
  score_ecologie smallint check (score_ecologie between -2 and 2),
  score_identite smallint check (score_identite between -2 and 2),
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'validee', 'rejetee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_opinions_idees_statut on opinions_idees(statut, created_at desc);

-- Instantané de l'idée AVANT une modification de fond (position, thème,
-- conviction, arguments, source ou scores) ; created_at = date de l'écrasement.
create table opinions_versions (
  id uuid primary key default gen_random_uuid(),
  idee_id uuid not null references opinions_idees(id) on delete cascade,
  position text not null,
  theme text,
  conviction text not null,
  arguments_pour text not null default '',
  arguments_contre text not null default '',
  source text not null default '',
  score_economique smallint,
  score_societal smallint,
  score_autorite smallint,
  score_ecologie smallint,
  score_identite smallint,
  created_at timestamptz not null default now()
);

create index idx_opinions_versions_idee_id on opinions_versions(idee_id, created_at desc);

alter table opinions_idees enable row level security;
alter table opinions_versions enable row level security;

commit;
