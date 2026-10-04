-- Durée estimée d'une tâche (en minutes), saisie dans le formulaire de tâche.
-- Prérequis du futur blocage de temps (proposer des créneaux libres selon la
-- durée). Null = durée non renseignée.
--
-- Le code n'écrit la colonne que lorsqu'une durée est saisie : l'application
-- reste utilisable avant l'application de cette migration, seule la saisie
-- d'une durée échoue tant que la colonne n'existe pas.
alter table taches
  add column if not exists duree_minutes integer null
  check (duree_minutes is null or (duree_minutes >= 1 and duree_minutes <= 1440));
