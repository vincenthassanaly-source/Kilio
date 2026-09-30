-- Retour arrière de migration-pharmacie-couleurs-cartes-2026-09-30.sql (réponses d'origine, texte simple).

update public.pharma_cartes set reponse = '0,70 à 1,10 g/L (3,9 à 6,1 mmol/L).'
where id = '16349549-8f80-450a-af90-d684f63fdb21';

update public.pharma_cartes set reponse = 'g/L × 5,55.'
where id = '521a5fd5-b2db-4b78-8c99-ac7be48b5a44';

update public.pharma_cartes set reponse = '≥ 1,26 g/L, confirmé sur deux prélèvements.'
where id = '3943f759-5946-49e8-a889-354f2d67992f';

update public.pharma_cartes set reponse = '1,10 à 1,25 g/L.'
where id = '8f1d094a-4594-4785-9d92-dcbcebaaf412';

update public.pharma_cartes set reponse = '≥ 2,00 g/L.'
where id = 'da86c9cd-c185-4480-ada8-bf98199d79a3';

update public.pharma_cartes set reponse = '< 1,40 g/L.'
where id = 'f9c81818-2ec8-416a-840c-42a8f63dc936';

update public.pharma_cartes set reponse = 'Normale < 5,7 % ; prédiabète 5,7 à 6,4 % ; diabète ≥ 6,5 %.'
where id = '9cce5496-2cc0-433e-93b7-607f701ae035';

update public.pharma_cartes set reponse = '< 0,70 g/L.'
where id = 'd020f3bd-29b4-408f-bbcd-acc58a3065f5';

update public.pharma_cartes set reponse = '< 0,54 g/L (< 3,0 mmol/L).'
where id = 'a7921430-91dc-4a07-9cec-5f27ff5af94c';

update public.pharma_cartes set reponse = 'En général ≤ 7 %, à adapter selon l''âge et les comorbidités.'
where id = '22d3d0b1-5d3f-4819-8a2a-2bef2bf87f68';

update public.pharma_cartes set reponse = '0,80 à 1,30 g/L.'
where id = '8a4a242b-09f6-4f30-b109-c95cdfbce44a';
