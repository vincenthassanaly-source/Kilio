-- Suppression de « Ajouter avec l'IA » : la table de réglages (liste par
-- défaut des tâches créées par la saisie en langage naturel) n'est plus lue
-- par l'app. À appliquer APRÈS le déploiement du code qui la retire.
-- Retour arrière : migration-suppression-saisie-ia-2026-10-02-revert.sql
-- (recrée la table vide ; la valeur du réglage n'est pas restaurée).
drop table if exists "public"."reglages_saisie_ia";
