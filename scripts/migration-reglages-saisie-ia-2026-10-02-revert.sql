-- Revert de migration-reglages-saisie-ia-2026-10-02.sql.
--
-- Ne touche pas à la fonction set_updated_at() : partagée avec d'autres modules.

drop trigger if exists trg_reglages_saisie_ia_updated_at on reglages_saisie_ia;
drop table if exists reglages_saisie_ia;
