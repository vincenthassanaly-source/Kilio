-- Annule migration-sport-seances-2026-10-02.sql (supprime aussi les données).
DROP TABLE IF EXISTS public.sport_series;
DROP TABLE IF EXISTS public.sport_seances;
DROP TABLE IF EXISTS public.sport_routine_exercices;
DROP TABLE IF EXISTS public.sport_routines;
