-- Réglages de « Ajouter avec l'IA » : liste par défaut des tâches créées par
-- la saisie en langage naturel. Sans liste citée dans la phrase, l'IA utilisait
-- la première liste (« Trucs à acheter » pour Vincent), d'où des rappels
-- rangés au mauvais endroit.
--
-- Table singleton (id fixé à 1, contrainte check), sur le modèle de
-- reglages_nettoyage. set_updated_at() existe déjà (migration-aliments),
-- réutilisée sans redéfinition. liste_taches_id est nullable : null = pas de
-- choix, l'app retombe sur une liste « Tâches » (créée à la validation).
-- on delete set null : supprimer la liste choisie ramène au repli.
create table reglages_saisie_ia (
  id smallint primary key default 1,
  liste_taches_id uuid null references listes_taches (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint reglages_saisie_ia_singleton check (id = 1)
);

create trigger trg_reglages_saisie_ia_updated_at
  before update on reglages_saisie_ia
  for each row execute function set_updated_at();

insert into reglages_saisie_ia (id, liste_taches_id)
values (1, null);

-- Convention Kilio : RLS activée sans policy (deny-all), le service_role
-- des Server Actions la contourne.
alter table "public"."reglages_saisie_ia" enable row level security;
