-- Module Opinions, Partis : explication d'une proposition en mots simples.
-- Trois champs, écrits en lot par le skill kilio-opinions après relecture par
-- thème : ce que la mesure change concrètement, le meilleur argument pour, le
-- meilleur argument contre (même rigueur des deux côtés). Aucune source ni date
-- n'est conservée : ce sont des aides à penser, pas des références ; le texte du
-- programme d'origine reste la seule référence.
-- Chaîne vide = pas encore expliquée (jamais null, comme opinions_idees).

begin;

alter table opinions_propositions
  add column explication_concret text not null default '' check (length(explication_concret) <= 600),
  add column explication_pour text not null default '' check (length(explication_pour) <= 600),
  add column explication_contre text not null default '' check (length(explication_contre) <= 600);

commit;
