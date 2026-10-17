-- Jours fériés (France métropolitaine) : copie locale de l'API Etalab
-- (calendrier.api.gouv.fr), remplie côté serveur année par année à la première
-- lecture (cf. src/app/actions/jours-feries.ts). Purement informatif : aucune
-- règle de l'app (tâches, habitudes, score, récurrences, ICS) n'en dépend.

create table if not exists jours_feries (
  date text primary key check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  nom text not null,
  created_at timestamptz not null default now()
);

-- RLS activée sans politique, comme les autres tables : seul le client admin
-- (service role) y accède.
alter table jours_feries enable row level security;
