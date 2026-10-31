-- Documents : recherche en langage naturel avec Gemini.
--
-- `documents_fiches` : une fiche texte par document (type, résumé et texte
-- extrait des fichiers par Gemini), lue au moment de la recherche pour que
-- Gemini retrouve les documents qui correspondent à la question.
--
-- Table à part (et non colonne de `documents`) : `getDocuments()` renvoie les
-- lignes de `documents` au navigateur, alors que le texte extrait (numéros,
-- dates, noms…) ne doit jamais quitter le serveur.
--
-- `signature` : empreinte SHA-256 de la liste ordonnée des URL de fichiers au
-- moment de la lecture. Si les fichiers changent (ajout, retrait,
-- remplacement), la signature ne correspond plus et la fiche est refaite ; un
-- simple renommage ou changement de notes/catégorie ne coûte aucun appel.
--
-- Aucune donnée existante n'est modifiée : les documents déjà présents sont
-- lus au fil des recherches.

create table documents_fiches (
  document_id uuid primary key references documents (id) on delete cascade,
  contenu text not null,
  signature text not null,
  updated_at timestamptz not null default now()
);

-- Même politique que les autres tables : RLS activée, aucune policy ; l'app
-- y accède uniquement côté serveur avec la clé service.
alter table documents_fiches enable row level security;
