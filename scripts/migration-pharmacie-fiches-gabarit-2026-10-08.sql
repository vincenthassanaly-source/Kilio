-- Pharmacie : fiches médicaments sur un gabarit unique (2026-10-08).
-- Sections fixes, dans l'ordre : MÉCANISME (gris) → DOSE (vert) → SURVEILLANCE (orange)
-- → INTERACTIONS (rouge) → À ÉVITER (orange) → CONTRE-INDICATIONS (rouge) → AVANTAGES (bleu).
-- Dans une section, « [couleur] # Texte » est un sous-titre. Texte médical inchangé
-- (empagliflozine : découpé en lignes ; éplérénone : titres harmonisés), chaque UPDATE est
-- gardé par le contenu d'origine. Retour arrière : migration-pharmacie-fiches-gabarit-2026-10-08-revert.sql.
begin;

update public.pharma_ref_molecules
set particularites = $n1$[gris] MÉCANISME
[gris] # Diabète de type 2
[gris] Le sucre en trop dans le sang est évacué par les urines (glycosurie), donc la glycémie baisse.
[gris] L'action ne passe pas par l'insuline : le risque d'hypoglycémie est faible.
[gris] Perte de poids légère et légère baisse de la tension.
[gris] Si le DFG est bas (reins fatigués), moins de sucre est éliminé et l'effet sur la glycémie diminue.
[gris] # Insuffisance cardiaque
[gris] Le sel et l'eau sont éliminés (natriurèse, diurèse osmotique) : le corps contient un peu moins de liquide.
[gris] Le cœur est moins rempli (précharge) et la tension est un peu plus basse (postcharge, la résistance contre laquelle il pompe).
[gris] Il travaille moins et il y a moins d'hospitalisations.
[gris] Fonctionne aussi chez les non-diabétiques.
[gris] # Maladie rénale chronique
[gris] Avec le temps, la pression dans les glomérules (les petits filtres du rein) devient trop forte et les abîme.
[gris] Avec plus de sel qui arrive en bout de circuit, le rein resserre l'entrée du filtre (rétrocontrôle tubuloglomérulaire) : la pression baisse, le filtre est protégé et le déclin est ralenti.
[gris] Le DFG baisse un peu au début : normal, et ça revient à l'arrêt.$n1$
where dci = 'empagliflozine'
  and particularites = $o1$1. Diabète de type 2
Le sucre en trop dans le sang est évacué par les urines (glycosurie), donc la glycémie baisse. L'action ne passe pas par l'insuline : le risque d'hypoglycémie est faible. Perte de poids légère et légère baisse de la tension. Si le DFG est bas (reins fatigués), moins de sucre est éliminé et l'effet sur la glycémie diminue.

2. Insuffisance cardiaque
Le sel et l'eau sont éliminés (natriurèse, diurèse osmotique) : le corps contient un peu moins de liquide. Le cœur est moins rempli (précharge) et la tension est un peu plus basse (postcharge, la résistance contre laquelle il pompe). Il travaille moins et il y a moins d'hospitalisations. Fonctionne aussi chez les non-diabétiques.

3. Maladie rénale chronique
Avec le temps, la pression dans les glomérules (les petits filtres du rein) devient trop forte et les abîme. Avec plus de sel qui arrive en bout de circuit, le rein resserre l'entrée du filtre (rétrocontrôle tubuloglomérulaire) : la pression baisse, le filtre est protégé et le déclin est ralenti. Le DFG baisse un peu au début : normal, et ça revient à l'arrêt.$o1$;

update public.pharma_ref_molecules
set particularites = $n2$[gris] MÉCANISME
[gris] Bloque l'aldostérone (hormone qui fait retenir sel et eau et perdre du potassium).
[gris] Résultat : moins de rétention d'eau et de sel, le cœur travaille moins, moins de fibrose (cœur raide et cicatriciel).
[gris] Utilisé en plus du traitement standard.

[vert] DOSE
[vert] 25 mg/jour au début.
[vert] Puis 50 mg/jour après 4 semaines si la kaliémie le permet.

[orange] SURVEILLANCE
[orange] Kaliémie avant le début, à 1 semaine, à 1 mois, puis régulièrement.
[rouge] Risque principal : hyperkaliémie (trop de potassium, dangereux pour le rythme cardiaque).

[rouge] INTERACTIONS
[rouge] Dégradé par le CYP3A4 (enzyme du foie).
[rouge] Contre-indiqué avec les antifongiques azolés, la clarithromycine et le ritonavir.
[orange] Jus de pamplemousse à éviter.

[orange] À ÉVITER
[orange] Sels de régime au potassium.
[orange] AINS (risque rénal et hyperkaliémique).

[rouge] CONTRE-INDICATIONS
[rouge] Insuffisance rénale sévère.

[bleu] AVANTAGES
[bleu] Avantage sur la spironolactone : pas de gynécomastie (développement des seins chez l'homme).$n2$
where dci = 'éplérénone'
  and particularites = $o2$[gris] MÉCANISME
[gris] Bloque l'aldostérone (hormone qui fait retenir sel et eau et perdre du potassium).
[gris] Résultat : moins de rétention d'eau et de sel, le cœur travaille moins, moins de fibrose (cœur raide et cicatriciel).
[gris] Utilisé en plus du traitement standard.

[vert] DOSE
[vert] 25 mg/jour au début.
[vert] Puis 50 mg/jour après 4 semaines si la kaliémie le permet.

[orange] SURVEILLANCE
[orange] Kaliémie avant le début, à 1 semaine, à 1 mois, puis régulièrement.
[rouge] Risque principal : hyperkaliémie (trop de potassium, dangereux pour le rythme cardiaque).

[rouge] INTERACTIONS
[rouge] Dégradé par le CYP3A4 (enzyme du foie).
[rouge] Contre-indiqué avec les antifongiques azolés, la clarithromycine et le ritonavir.
[orange] Jus de pamplemousse à éviter.

[orange] À ÉVITER
[orange] Sels de régime au potassium.
[orange] AINS (risque rénal et hyperkaliémique).

[rouge] CONTRE-INDICATION
[rouge] Insuffisance rénale sévère.

[gris] AVANTAGE SUR LA SPIRONOLACTONE
[gris] Pas de gynécomastie (développement des seins chez l'homme).$o2$;

commit;
