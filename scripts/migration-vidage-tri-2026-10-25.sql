-- « Vider ma tête » : marque « triée » posée par le skill kilio-vidage-tri
-- (kilaskills), qui propose des tâches, notes et événements depuis le texte du jour.
--
-- `trie_le` : instant du dernier tri du jour ; null tant que le jour n'a jamais
-- été trié. Un jour est « à trier » quand `transcription` n'est pas vide ET
-- (`trie_le` est null OU `trie_le < updated_at`) : du texte ajouté après le tri
-- remet donc le jour à trier. Aucun trigger sur `updated_at` pour cette table
-- (l'app le pose elle-même dans src/app/actions/vidage.ts) : poser `trie_le`
-- ne le fait pas bouger.

alter table feuilles_vidage
  add column trie_le timestamptz;
