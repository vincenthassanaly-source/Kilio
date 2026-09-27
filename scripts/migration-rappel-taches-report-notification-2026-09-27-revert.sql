-- Revert de migration-rappel-taches-report-notification-2026-09-27.sql.

alter table taches
  drop column if exists rappel_reporte_jusqua;
