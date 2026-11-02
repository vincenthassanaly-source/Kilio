-- Documents : bouton « Description » (résumé simple écrit par Gemini).
--
-- `documents_descriptions` : une description par document (phrase de résumé
-- et puces d'éléments principaux), générée au clic sur le bouton puis relue
-- sans nouvel appel Gemini.
--
-- `contenu` : jsonb `{ "resume": string, "points": string[] }`.
--
-- `signature` : empreinte SHA-256 de la liste ordonnée des URL de fichiers au
-- moment de la lecture (même calcul que `documents_fiches`). Si les fichiers
-- changent, la description est refaite au prochain clic ; un renommage ou un
-- changement de notes/catégorie ne coûte aucun appel.
--
-- Table à part (et non colonne de `documents`), comme `documents_fiches` :
-- `getDocuments()` renvoie les lignes de `documents` au navigateur, alors que
-- le contenu extrait ne passe que par l'action serveur dédiée.
--
-- Aucune donnée existante n'est modifiée.

create table documents_descriptions (
  document_id uuid primary key references documents (id) on delete cascade,
  contenu jsonb not null,
  signature text not null,
  updated_at timestamptz not null default now()
);

-- Même politique que les autres tables : RLS activée, aucune policy ; l'app
-- y accède uniquement côté serveur avec la clé service.
alter table documents_descriptions enable row level security;
