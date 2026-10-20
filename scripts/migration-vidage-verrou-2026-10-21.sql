-- « Vider ma tête » : verrou biométrique (WebAuthn / passkey du téléphone).
--
-- Une seule ligne (`id = 1`) : un seul téléphone peut déverrouiller le module, le premier qui
-- s'inscrit (premier arrivé, premier servi). Pas de user_id (app mono-utilisateur) ; RLS activée
-- sans politique, comme les autres tables (l'app passe par la clé service role).
--
-- `public_key` : clé publique COSE en base64url. `counter` : compteur de signatures de la passkey.
--
-- Changer de téléphone : supprimer la ligne, puis se réinscrire AUSSITÔT depuis le nouveau
-- téléphone (tant que la table est vide, n'importe qui connaissant l'URL pourrait s'inscrire) :
--   delete from vidage_passkey;
--
-- À déployer avec la variable d'environnement VIDAGE_SESSION_SECRET (32 caractères minimum,
-- aléatoire, ex. `openssl rand -base64 48`) : elle signe le cookie de session de 15 minutes.

begin;

create table vidage_passkey (
  id integer primary key default 1 check (id = 1),
  credential_id text not null,
  public_key text not null,
  counter bigint not null default 0,
  transports text[],
  created_at timestamptz not null default now()
);

alter table vidage_passkey enable row level security;

commit;
