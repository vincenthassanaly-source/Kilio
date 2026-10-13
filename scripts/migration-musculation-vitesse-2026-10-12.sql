-- Marche : mode de saisie « durée + vitesse » (km/h), une seule ligne par exercice.
-- Étape 1 (appliquée avant le déploiement du code, additive) :
alter table public.entrainement_series add column if not exists vitesse_kmh numeric;
alter table public.routine_series add column if not exists vitesse_kmh numeric;
alter table public.entrainement_series add constraint entrainement_series_vitesse_kmh_check check (vitesse_kmh is null or (vitesse_kmh >= 0 and vitesse_kmh <= 100));
alter table public.routine_series add constraint routine_series_vitesse_kmh_check check (vitesse_kmh is null or (vitesse_kmh >= 0 and vitesse_kmh <= 100));
alter table public.exercices drop constraint exercices_mode_saisie_check;
alter table public.exercices add constraint exercices_mode_saisie_check check (mode_saisie = any (array['poids_reps','poids_corps_reps','duree','distance_duree','poids_duree','duree_vitesse']));

-- Reprise de l'historique de la marche : vitesse déduite de distance / durée.
update public.entrainement_series s set vitesse_kmh = round((s.distance_m / s.duree_s * 3.6)::numeric, 1)
from public.entrainement_exercices ee join public.exercices e on e.id = ee.exercice_id
where ee.id = s.entrainement_exercice_id and e.nom = 'Marche' and s.distance_m > 0 and s.duree_s > 0 and s.distance_m / s.duree_s * 3.6 <= 100;

-- Étape 2 (appliquée au déploiement du code) : l'exercice Marche passe en durée + vitesse.
update public.exercices set mode_saisie = 'duree_vitesse' where nom = 'Marche' and mode_saisie = 'distance_duree';
