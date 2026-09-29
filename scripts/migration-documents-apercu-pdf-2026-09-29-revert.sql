-- Revert de migration-documents-apercu-pdf-2026-09-29.sql
-- Les images d'aperçu restent dans le bucket `documents-fichiers` (fichiers
-- `<uuid>.jpg` orphelins) : à purger à la main si besoin.

alter table document_fichiers drop column if exists apercu_url;
