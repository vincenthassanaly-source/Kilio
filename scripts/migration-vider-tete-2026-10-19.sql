-- Module « Vider ma tête » : une feuille manuscrite par jour (traits vectoriels)
-- et le rappel push du soir. Pas de user_id (app mono-utilisateur) ; RLS activée
-- sans politique, comme les autres tables (l'app passe par la clé service role).
--
-- `traits` : tableau JSON de traits { e: épaisseur 1-3, p: [x, y, pression, ...] }
-- en coordonnées logiques (largeur de la feuille = 1000), voir
-- src/lib/vidage/traits.ts. `hauteur` : hauteur logique de la feuille.
--
-- L'aperçu image (PNG) vit dans le bucket PRIVÉ `vider-tete` (journal intime :
-- jamais d'URL publique). Lecture par URL signée, générée côté serveur.
-- Déployer aussi l'Edge Function : supabase functions deploy envoyer-rappel-vidage
-- puis appliquer migration-cron-rappel-vidage-2026-10-19.sql.

begin;

create table feuilles_vidage (
  jour date primary key,
  traits jsonb not null default '[]'::jsonb check (jsonb_typeof(traits) = 'array'),
  hauteur integer not null default 2000 check (hauteur between 1 and 60000),
  apercu_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table feuilles_vidage enable row level security;

-- Rappel du soir : même schéma que bilan_* / revue_* de reglages_briefing.
alter table reglages_briefing
  add column vidage_actif boolean not null default false,
  add column vidage_heure time not null default '21:00',
  add column vidage_dernier_envoi date;

insert into storage.buckets (id, name, public)
values ('vider-tete', 'vider-tete', false)
on conflict (id) do nothing;

commit;
