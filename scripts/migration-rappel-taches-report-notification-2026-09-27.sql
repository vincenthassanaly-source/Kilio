-- Ajoute la possibilité de reporter un rappel directement depuis les
-- actions de la notification push (+1h / +1 jour / +1 semaine), sans
-- rouvrir l'app.
--
-- rappel_reporte_jusqua est volontairement distinct de rappel_envoye_le :
-- reporter une notification ne doit pas changer l'échéance réelle de la
-- tâche (echeance/heure), seulement quand la prochaine notification part.
-- envoyer-rappels-taches vérifie ce champ en plus du calcul habituel
-- echeance/heure/rappel_minutes, et le remet à null une fois la relance
-- envoyée.
alter table taches
  add column rappel_reporte_jusqua timestamptz null;
