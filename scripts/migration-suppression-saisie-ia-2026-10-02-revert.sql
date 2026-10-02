-- Retour arrière de migration-suppression-saisie-ia-2026-10-02.sql :
-- identique à migration-reglages-saisie-ia-2026-10-02.sql.
create table if not exists reglages_saisie_ia (
  id smallint primary key default 1,
  liste_taches_id uuid null references listes_taches (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint reglages_saisie_ia_singleton check (id = 1)
);

drop trigger if exists trg_reglages_saisie_ia_updated_at on reglages_saisie_ia;
create trigger trg_reglages_saisie_ia_updated_at
  before update on reglages_saisie_ia
  for each row execute function set_updated_at();

insert into reglages_saisie_ia (id, liste_taches_id)
values (1, null)
on conflict (id) do nothing;

alter table "public"."reglages_saisie_ia" enable row level security;
