-- Coloration des 6 notions du chapitre « Biologie clinique › Glycémie et
-- diabète » (syntaxe `[couleur] ligne`, voir src/lib/pharmacie/contenu.ts).
-- Le texte médical est inchangé mot pour mot : seuls des retours à la ligne et
-- des balises sont ajoutés (les « ; » de fin de ligne de la notion HGPO sont
-- retirés). À appliquer APRÈS le déploiement du rendu coloré (sinon les
-- balises s'affichent telles quelles). Retour arrière : -revert.sql.
-- Chaque UPDATE ne s'applique que si le contenu est encore celui d'origine.

update public.pharma_notions set updated_at = now(), contenu = '[vert] Adulte non diabétique, à jeun depuis au moins 8 h : 0,70 à 1,10 g/L (3,9 à 6,1 mmol/L).
[gris] Conversion : g/L × 5,55 = mmol/L.'
where id = '5983e892-9dce-4035-a2bf-284ba6cebab7'
  and contenu = 'Adulte non diabétique, à jeun depuis au moins 8 h : 0,70 à 1,10 g/L (3,9 à 6,1 mmol/L). Conversion : g/L × 5,55 = mmol/L.';

update public.pharma_notions set updated_at = now(), contenu = '[orange] Hyperglycémie modérée à jeun (prédiabète) : 1,10 à 1,25 g/L.
[rouge] Diabète : glycémie à jeun ≥ 1,26 g/L confirmée sur deux prélèvements, ou glycémie aléatoire ≥ 2,00 g/L avec symptômes.'
where id = 'd12a52a0-507d-45d2-a417-22d0110c7716'
  and contenu = 'Hyperglycémie modérée à jeun (prédiabète) : 1,10 à 1,25 g/L. Diabète : glycémie à jeun ≥ 1,26 g/L confirmée sur deux prélèvements, ou glycémie aléatoire ≥ 2,00 g/L avec symptômes.';

update public.pharma_notions set updated_at = now(), contenu = '[vert] À 2 h après un repas : < 1,40 g/L.
[gris] HGPO (75 g de glucose), glycémie à 2 h :
[vert] < 1,40 g/L normal
[orange] 1,40 à 1,99 g/L intolérance au glucose
[rouge] ≥ 2,00 g/L diabète.'
where id = '7fea5c1e-105d-4460-82c7-c8244c433264'
  and contenu = 'À 2 h après un repas : < 1,40 g/L. HGPO (75 g de glucose), glycémie à 2 h : < 1,40 g/L normal ; 1,40 à 1,99 g/L intolérance au glucose ; ≥ 2,00 g/L diabète.';

update public.pharma_notions set updated_at = now(), contenu = '[vert] Normale : < 5,7 % (< 39 mmol/mol).
[orange] Prédiabète : 5,7 à 6,4 %.
[rouge] Diabète : ≥ 6,5 %.'
where id = '56b0d049-7457-4f75-9d81-baa58fc9d92f'
  and contenu = 'Normale : < 5,7 % (< 39 mmol/mol). Prédiabète : 5,7 à 6,4 %. Diabète : ≥ 6,5 %.';

update public.pharma_notions set updated_at = now(), contenu = '[bleu] Seuil biologique : < 0,70 g/L.
[rouge] Hypoglycémie sévère : < 0,54 g/L (< 3,0 mmol/L).'
where id = '2c350da2-7480-4a8e-b43f-2d549cd208e5'
  and contenu = 'Seuil biologique : < 0,70 g/L. Hypoglycémie sévère : < 0,54 g/L (< 3,0 mmol/L).';

update public.pharma_notions set updated_at = now(), contenu = '[vert] HbA1c cible en général ≤ 7 %, à adapter selon l''âge et les comorbidités.
[vert] Glycémie à jeun ou préprandiale cible : 0,80 à 1,30 g/L.'
where id = '370a6144-bdff-4236-8ebc-ac4ef1542303'
  and contenu = 'HbA1c cible en général ≤ 7 %, à adapter selon l''âge et les comorbidités. Glycémie à jeun ou préprandiale cible : 0,80 à 1,30 g/L.';
