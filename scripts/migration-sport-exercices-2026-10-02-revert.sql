-- Annule migration-sport-exercices-2026-10-02.sql.
-- Les objets du bucket doivent être supprimés avant le bucket (API Storage ;
-- un DELETE direct dans storage.objects laisse les fichiers orphelins).
DROP TABLE IF EXISTS public.sport_exercices;
DELETE FROM storage.buckets WHERE id = 'sport-exercices';
