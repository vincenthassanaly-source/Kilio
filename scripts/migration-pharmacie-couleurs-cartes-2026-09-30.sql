-- Coloration des réponses des 11 cartes de « Glycémie et diabète » (syntaxe [couleur] ligne).
-- Texte inchangé mot pour mot (seuls les « ; » de la carte HbA1c deviennent des retours à la ligne).
-- Chaque UPDATE ne s'applique que si la réponse est encore celle d'origine. Retour arrière : -revert.sql.

update public.pharma_cartes set reponse = '[vert] 0,70 à 1,10 g/L (3,9 à 6,1 mmol/L).'
where id = '16349549-8f80-450a-af90-d684f63fdb21'
  and reponse = '0,70 à 1,10 g/L (3,9 à 6,1 mmol/L).';

update public.pharma_cartes set reponse = '[gris] g/L × 5,55.'
where id = '521a5fd5-b2db-4b78-8c99-ac7be48b5a44'
  and reponse = 'g/L × 5,55.';

update public.pharma_cartes set reponse = '[rouge] ≥ 1,26 g/L, confirmé sur deux prélèvements.'
where id = '3943f759-5946-49e8-a889-354f2d67992f'
  and reponse = '≥ 1,26 g/L, confirmé sur deux prélèvements.';

update public.pharma_cartes set reponse = '[orange] 1,10 à 1,25 g/L.'
where id = '8f1d094a-4594-4785-9d92-dcbcebaaf412'
  and reponse = '1,10 à 1,25 g/L.';

update public.pharma_cartes set reponse = '[rouge] ≥ 2,00 g/L.'
where id = 'da86c9cd-c185-4480-ada8-bf98199d79a3'
  and reponse = '≥ 2,00 g/L.';

update public.pharma_cartes set reponse = '[vert] < 1,40 g/L.'
where id = 'f9c81818-2ec8-416a-840c-42a8f63dc936'
  and reponse = '< 1,40 g/L.';

update public.pharma_cartes set reponse = '[vert] Normale < 5,7 %
[orange] prédiabète 5,7 à 6,4 %
[rouge] diabète ≥ 6,5 %.'
where id = '9cce5496-2cc0-433e-93b7-607f701ae035'
  and reponse = 'Normale < 5,7 % ; prédiabète 5,7 à 6,4 % ; diabète ≥ 6,5 %.';

update public.pharma_cartes set reponse = '[bleu] < 0,70 g/L.'
where id = 'd020f3bd-29b4-408f-bbcd-acc58a3065f5'
  and reponse = '< 0,70 g/L.';

update public.pharma_cartes set reponse = '[rouge] < 0,54 g/L (< 3,0 mmol/L).'
where id = 'a7921430-91dc-4a07-9cec-5f27ff5af94c'
  and reponse = '< 0,54 g/L (< 3,0 mmol/L).';

update public.pharma_cartes set reponse = '[vert] En général ≤ 7 %, à adapter selon l''âge et les comorbidités.'
where id = '22d3d0b1-5d3f-4819-8a2a-2bef2bf87f68'
  and reponse = 'En général ≤ 7 %, à adapter selon l''âge et les comorbidités.';

update public.pharma_cartes set reponse = '[vert] 0,80 à 1,30 g/L.'
where id = '8a4a242b-09f6-4f30-b109-c95cdfbce44a'
  and reponse = '0,80 à 1,30 g/L.';
