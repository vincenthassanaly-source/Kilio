-- Seed du référentiel Pharmacie : premier lot (HTA, diabète de type 2,
-- dyslipidémies, insuffisance cardiaque / fibrillation atriale).
-- Contenu rédigé par Claude à partir des recommandations HAS / ESC / ESH / SFD
-- (source et date portées par chaque pathologie). Les noms commerciaux et
-- dosages sont ceux des spécialités courantes en France : à confronter à la
-- BDPM en cas de doute. Apostrophes typographiques (’) pour éviter
-- l’échappement SQL. Idempotent : on conflict do nothing (noms uniques).

create or replace function pg_temp.c(p_nom text, p_parent text, p_atc text, p_mec text, p_ci text, p_inter text, p_cons text)
returns void language sql as $$
  insert into public.pharma_ref_classes (nom, parent_id, atc, mecanisme, contre_indications, interactions, conseils, ordre)
  values (p_nom, (select id from public.pharma_ref_classes where lower(nom) = lower(p_parent)), p_atc, p_mec, p_ci, p_inter, p_cons,
          (select count(*) from public.pharma_ref_classes))
  on conflict do nothing;
$$;

-- p_ind : indications séparées par « ; » ; p_marques : « nom|dosages ; nom|dosages ».
create or replace function pg_temp.m(p_dci text, p_classe text, p_ind text, p_partic text, p_marques text, p_compo text default null)
returns void language plpgsql as $$
declare v_id uuid; v_m text;
begin
  insert into public.pharma_ref_molecules (dci, classe_id, association, composants, indications, particularites, ordre)
  values (p_dci, (select id from public.pharma_ref_classes where lower(nom) = lower(p_classe)), p_compo is not null,
          coalesce(string_to_array(p_compo, ', '), '{}'), string_to_array(p_ind, ' ; '), p_partic,
          (select count(*) from public.pharma_ref_molecules))
  on conflict do nothing;
  select id into v_id from public.pharma_ref_molecules where lower(dci) = lower(p_dci);
  foreach v_m in array string_to_array(p_marques, ' ; ') loop
    insert into public.pharma_ref_specialites (molecule_id, nom, dosages)
    values (v_id, split_part(v_m, '|', 1), nullif(split_part(v_m, '|', 2), ''))
    on conflict do nothing;
  end loop;
end $$;

create or replace function pg_temp.p(p_nom text, p_resume text, p_source text, p_date text)
returns void language sql as $$
  insert into public.pharma_ref_pathologies (nom, resume, source, source_date, ordre)
  values (p_nom, p_resume, p_source, p_date, (select count(*) from public.pharma_ref_pathologies))
  on conflict do nothing;
$$;

create or replace function pg_temp.l(p_path text, p_profil text, p_rang int, p_titre text, p_desc text)
returns void language sql as $$
  insert into public.pharma_ref_lignes (pathologie_id, profil, rang, titre, description)
  values ((select id from public.pharma_ref_pathologies where lower(nom) = lower(p_path)), p_profil, p_rang, p_titre, p_desc);
$$;

-- Cible : nom de classe, sinon DCI de molécule. p_role : traitement | association | eviter.
create or replace function pg_temp.i(p_path text, p_profil text, p_rang int, p_role text, p_cible text, p_note text default null)
returns void language sql as $$
  insert into public.pharma_ref_ligne_items (ligne_id, classe_id, molecule_id, role, note, ordre)
  select l.id,
         (select id from public.pharma_ref_classes where lower(nom) = lower(p_cible)),
         (select id from public.pharma_ref_molecules where lower(dci) = lower(p_cible)
            and not exists (select 1 from public.pharma_ref_classes where lower(nom) = lower(p_cible))),
         p_role, p_note,
         (select count(*) from public.pharma_ref_ligne_items where ligne_id = l.id)
  from public.pharma_ref_lignes l
  join public.pharma_ref_pathologies pa on pa.id = l.pathologie_id
  where lower(pa.nom) = lower(p_path) and l.profil = p_profil and l.rang = p_rang
  limit 1;
$$;

-- ============================ CLASSES ============================

select pg_temp.c('Cardiovasculaire', null, 'C', null, null, null, null);
select pg_temp.c('Antidiabétiques', null, 'A10', null, null, null, null);
select pg_temp.c('Hypolipémiants', null, 'C10', null, null, null, null);

select pg_temp.c('IEC', 'Cardiovasculaire', 'C09A',
  'Inhibent l’enzyme de conversion : moins d’angiotensine II (vasoconstriction, aldostérone) et moins de dégradation de la bradykinine.',
  'Grossesse (déconseillés au 1er trimestre, contre-indiqués aux 2e et 3e) ; antécédent d’angiœdème ; sténose bilatérale des artères rénales ; hyperkaliémie ; association au sacubitril (respecter 36 h d’écart).',
  'Hyperkaliémie avec ARM, potassium, triméthoprime ; insuffisance rénale aiguë avec AINS + diurétique (« triple whammy ») ; lithium (lithémie ↑) ; double blocage IEC + ARA2 non recommandé.',
  'Toux sèche fréquente (bradykinine) : passer à un ARA2. Angiœdème (visage, lèvres) : arrêt et urgence. Hypotension à la 1re prise. Contrôler créatinine et kaliémie à 1–2 semaines. Suspendre en cas de déshydratation (diarrhée, vomissements, fièvre).');
select pg_temp.c('ARA2', 'Cardiovasculaire', 'C09C',
  'Antagonistes des récepteurs AT1 de l’angiotensine II (« sartans ») : effet proche des IEC sans accumulation de bradykinine.',
  'Grossesse (déconseillés au 1er trimestre, contre-indiqués aux 2e et 3e) ; hyperkaliémie ; sténose bilatérale des artères rénales ; insuffisance hépatique sévère (selon molécule).',
  'Mêmes que les IEC : hyperkaliémie (ARM, potassium), AINS, lithium ; éviter l’association IEC + ARA2.',
  'Pas de toux : alternative en cas d’intolérance aux IEC. Mêmes précautions rénales et « sick days » que les IEC. Femme en âge de procréer : prévenir en cas de grossesse.');
select pg_temp.c('ARNI', 'Cardiovasculaire', 'C09DX04',
  'Sacubitril (inhibiteur de la néprilysine) + valsartan : augmente les peptides natriurétiques tout en bloquant le système rénine-angiotensine.',
  'Angiœdème ; association à un IEC (attendre 36 h après l’arrêt de l’IEC) ; grossesse ; insuffisance hépatique sévère.',
  'IEC (contre-indiqué), aliskirène chez le diabétique, hyperkaliémie avec ARM et potassium.',
  'Remplace l’IEC/ARA2 dans l’insuffisance cardiaque à FEVG réduite. Surveiller tension, kaliémie et créatinine ; titration toutes les 2–4 semaines.');
select pg_temp.c('Inhibiteurs calciques dihydropyridines', 'Cardiovasculaire', 'C08CA',
  'Bloquent les canaux calciques de type L de la paroi artérielle : vasodilatation artérielle, baisse des résistances périphériques.',
  'Choc cardiogénique ; sténose aortique serrée ; angor instable ; infarctus récent (selon molécule).',
  'Jus de pamplemousse et inhibiteurs du CYP3A4 (clarithromycine, azolés) ↑ les concentrations ; simvastatine limitée à 20 mg avec l’amlodipine.',
  'Œdèmes des chevilles dose-dépendants, non sensibles aux diurétiques ; céphalées et bouffées de chaleur en début de traitement. Le plus souvent bien toléré au long cours.');
select pg_temp.c('Inhibiteurs calciques non dihydropyridines', 'Cardiovasculaire', 'C08D',
  'Bloquent les canaux calciques de type L du myocarde et du nœud sinusal/AV : effet bradycardisant et inotrope négatif, vasodilatation modérée.',
  'Bloc auriculo-ventriculaire 2e–3e degré ; insuffisance cardiaque à FEVG réduite ; bradycardie sévère ; association à un bêta-bloquant (risque de bradycardie et de bloc).',
  'Bêta-bloquants, digoxine (↑ digoxinémie), amiodarone ; simvastatine et atorvastatine (CYP3A4) ; vérapamil + dabigatran.',
  'Constipation fréquente avec le vérapamil. Surveiller le pouls. Éviter l’association avec un bêta-bloquant sans avis cardiologique.');
select pg_temp.c('Diurétiques thiazidiques et apparentés', 'Cardiovasculaire', 'C03A / C03BA',
  'Inhibent le cotransporteur Na⁺/Cl⁻ du tube contourné distal : natriurèse, baisse de la volémie puis des résistances.',
  'Hypokaliémie sévère ; hyponatrémie ; insuffisance rénale sévère (inefficaces si DFG < 30) ; insuffisance hépatique sévère ; goutte (relative).',
  'Lithium (↑ lithémie) ; autres hypokaliémiants et digoxine (toxicité) ; AINS ; hydrochlorothiazide : surveiller le risque cutané.',
  'Hypokaliémie, hyponatrémie, hyperuricémie, hyperglycémie modérée. Hydratation et suspension temporaire en cas de vomissements ou fortes chaleurs. Hydrochlorothiazide : photoprotection (sur-risque de cancers cutanés non mélaniques).');
select pg_temp.c('Diurétiques de l’anse', 'Cardiovasculaire', 'C03C',
  'Inhibent le cotransporteur Na⁺-K⁺-2Cl⁻ de la branche ascendante de l’anse de Henlé : diurèse puissante et rapide.',
  'Anurie ; hypovolémie ; hypokaliémie sévère ; encéphalopathie hépatique.',
  'Aminosides (oto- et néphrotoxicité) ; AINS ; lithium ; digoxine (hypokaliémie) ; autres diurétiques.',
  'Prise le matin. Surveiller poids, kaliémie et fonction rénale. Ototoxicité à forte dose intraveineuse. Indiqués surtout dans l’insuffisance cardiaque congestive et l’HTA de l’insuffisance rénale (DFG < 30).');
select pg_temp.c('Antagonistes des récepteurs minéralocorticoïdes (ARM)', 'Cardiovasculaire', 'C03DA',
  'Bloquent le récepteur de l’aldostérone : diurétique épargneur de potassium et effet antifibrosant cardiaque et rénal.',
  'Hyperkaliémie ; insuffisance rénale sévère (DFG < 30 en général) ; maladie d’Addison.',
  'IEC, ARA2, ARNI, apports potassiques, triméthoprime, AINS (hyperkaliémie) ; éplérénone : inhibiteurs puissants du CYP3A4.',
  'Contrôle de la kaliémie et de la créatinine à 1 semaine, 1 mois puis régulièrement. Éviter les substituts de sel (chlorure de potassium). Spironolactone : gynécomastie et troubles des règles possibles (éplérénone mieux tolérée).');
select pg_temp.c('Bêta-bloquants', 'Cardiovasculaire', 'C07',
  'Bloquent les récepteurs bêta-adrénergiques : baisse de la fréquence cardiaque, de la contractilité et de la consommation d’oxygène du myocarde.',
  'Asthme et BPCO sévères (surtout non cardiosélectifs) ; bloc auriculo-ventriculaire 2e–3e degré non appareillé ; bradycardie < 50/min ; choc cardiogénique ; insuffisance cardiaque aiguë décompensée ; maladie de Raynaud sévère.',
  'Vérapamil, diltiazem (bradycardie, bloc) ; amiodarone ; clonidine (arrêt brutal : HTA rebond) ; insuline et antidiabétiques (masquent l’hypoglycémie) ; antiarythmiques de classe I.',
  'Ne jamais arrêter brutalement. Fatigue, extrémités froides, troubles du sommeil. Chez le diabétique traité, les signes d’hypoglycémie (palpitations, tremblements) sont masqués ; la sueur persiste.');
select pg_temp.c('Antihypertenseurs centraux', 'Cardiovasculaire', 'C02AC',
  'Stimulent les récepteurs imidazoline ou alpha-2 centraux : baisse du tonus sympathique.',
  'Bradycardie sévère, bloc auriculo-ventriculaire, syndrome du sinus malade ; insuffisance cardiaque sévère ; dépression sévère (rilménidine).',
  'Dépresseurs du système nerveux central, alcool (somnolence) ; antidépresseurs tricycliques (antagonisent l’effet) ; bêta-bloquants (clonidine).',
  'Sécheresse buccale, somnolence. Classe de recours (4e–5e ligne). Clonidine : arrêt progressif obligatoire.');
select pg_temp.c('Alpha-bloquants', 'Cardiovasculaire', 'C02CA',
  'Bloquent les récepteurs alpha-1 vasculaires : vasodilatation.',
  'Hypotension orthostatique ; insuffisance cardiaque (doxazosine) ; antécédent de syncope mictionnelle.',
  'Autres antihypertenseurs et inhibiteurs de la PDE5 (hypotension) ; alcool.',
  'Hypotension orthostatique : 1re prise au coucher, se lever lentement. Classe de recours ; la doxazosine soulage aussi les symptômes de l’HBP.');
select pg_temp.c('Associations fixes antihypertensives', 'Cardiovasculaire', 'C09B / C09D / C07B',
  'Deux ou trois principes actifs en un comprimé : améliore l’observance et la rapidité du contrôle tensionnel.',
  'Celles de chaque composant.',
  'Celles de chaque composant.',
  'Un comprimé par jour : favoriser l’observance. Vérifier les doublons (ne pas ajouter un composant déjà présent dans l’association fixe). Substitution générique possible.');
select pg_temp.c('Inhibiteur du courant If (ivabradine)', 'Cardiovasculaire', 'C01EB17',
  'Inhibe le courant If du nœud sinusal : ralentit la fréquence cardiaque sans effet inotrope négatif.',
  'Fréquence < 70/min au repos ; choc cardiogénique ; association à des inhibiteurs puissants du CYP3A4 (kétoconazole, clarithromycine) ; grossesse.',
  'Vérapamil, diltiazem ; inhibiteurs du CYP3A4 ; médicaments allongeant le QT.',
  'Phosphènes (éblouissements lumineux) transitoires fréquents. Risque accru de fibrillation atriale : dépister le pouls irrégulier.');
select pg_temp.c('Digitaliques', 'Cardiovasculaire', 'C01AA',
  'Inhibent la Na⁺/K⁺-ATPase : inotrope positif et ralentissement de la conduction auriculo-ventriculaire.',
  'Bloc auriculo-ventriculaire 2e–3e degré ; tachycardie ventriculaire ; hypokaliémie non corrigée ; syndrome de WPW.',
  'Amiodarone, vérapamil, macrolides, quinidine (↑ digoxinémie) ; diurétiques hypokaliémiants (toxicité) ; millepertuis (↓ effet).',
  'Marge thérapeutique étroite. Signes de surdosage : nausées, vomissements, vision jaune, bradycardie, troubles du rythme. Adapter la dose à la fonction rénale et à l’âge.');
select pg_temp.c('Stimulateur de la guanylate cyclase soluble', 'Cardiovasculaire', 'C01DX',
  'Stimule la guanylate cyclase soluble (voie NO-GMPc) : vasodilatation et effet cardioprotecteur.',
  'Grossesse ; association à un inhibiteur de la PDE5 ou à un autre stimulateur de la guanylate cyclase ; hypotension symptomatique.',
  'Inhibiteurs de la PDE5 (contre-indiqué), dérivés nitrés (prudence).',
  'Contraception efficace chez la femme en âge de procréer (tératogène). Réservé à l’insuffisance cardiaque à FEVG réduite avec aggravation récente.');
select pg_temp.c('Antiarythmiques', 'Cardiovasculaire', 'C01B',
  'Modifient l’électrophysiologie cardiaque : contrôle du rythme (classes I, III) ou de la fréquence.',
  'Bloc auriculo-ventriculaire non appareillé ; classe I : cardiopathie ischémique ou structurelle ; amiodarone : dysthyroïdie ; dronédarone : insuffisance cardiaque NYHA III–IV et FA permanente.',
  'Amiodarone : AVK (↑ INR), digoxine, statines, médicaments allongeant le QT ; sotalol : hypokaliémie, QT ; flécaïnide : bêta-bloquants.',
  'Amiodarone : photosensibilité, dysthyroïdies, atteinte pulmonaire, dépôts cornéens, demi-vie très longue ; bilan thyroïdien et hépatique régulier. Toujours sous contrôle spécialisé.');
select pg_temp.c('Anticoagulants oraux directs (AOD)', 'Cardiovasculaire', 'B01AF / B01AE',
  'Apixaban, rivaroxaban, edoxaban : inhibiteurs directs du facteur Xa ; dabigatran : inhibiteur direct de la thrombine.',
  'Saignement actif ; insuffisance hépatique avec coagulopathie ; valve cardiaque mécanique ; sténose mitrale modérée à sévère ; syndrome des antiphospholipides triple positif ; grossesse ; dabigatran : DFG < 30.',
  'Inducteurs puissants (rifampicine, carbamazépine, phénytoïne, millepertuis) ↓ l’efficacité ; inhibiteurs puissants (kétoconazole, ritonavir) ↑ le risque ; AINS, aspirine, antiagrégants ↑ le saignement ; amiodarone, vérapamil ↑ dabigatran.',
  'Pas de surveillance de l’INR mais fonction rénale au moins annuelle. Carte patient à porter. Ne jamais arrêter sans avis. Oubli : apixaban et dabigatran, prendre dès que possible le jour même, jamais de double dose. Rivaroxaban 15/20 mg : pendant le repas. Éviter l’automédication par AINS ou aspirine.');
select pg_temp.c('Antivitamines K (AVK)', 'Cardiovasculaire', 'B01AA',
  'Inhibent la synthèse hépatique des facteurs vitamine K-dépendants (II, VII, IX, X).',
  'Saignement actif ; insuffisance hépatique sévère ; grossesse (tératogène au 1er trimestre) ; HTA sévère non contrôlée.',
  'Très nombreuses : AINS et aspirine, macrolides, fluoroquinolones, azolés, amiodarone, paracétamol à forte dose prolongée, statines, millepertuis (↓ effet), alimentation riche en vitamine K (choux, épinards).',
  'INR cible en général 2–3 (prothèses mitrales mécaniques : plus élevé). Carnet de suivi, contrôle de l’INR à chaque modification de traitement ou d’alimentation. Régularité de la prise le soir. Fluindione : demi-vie longue, réactions immuno-allergiques rares.');

select pg_temp.c('Biguanides', 'Antidiabétiques', 'A10BA',
  'Diminue la production hépatique de glucose et augmente la sensibilité à l’insuline ; pas d’hypoglycémie en monothérapie.',
  'DFG < 30 ml/min ; insuffisance hépatique ; insuffisance cardiaque ou respiratoire aiguë, hypoxie ; acidose ; alcoolisme aigu ; produit de contraste iodé (suspendre selon le DFG).',
  'Produits de contraste iodés ; alcool ; diurétiques de l’anse et AINS (altération rénale) ; cimétidine, dolutégravir (↑ metformine).',
  'Effets digestifs : prendre au cours du repas, augmenter progressivement. Dose maximale réduite si DFG 30–45 (≈ 1 g/j). Déficit en vitamine B12 possible au long cours. Suspendre en cas de déshydratation, de vomissements ou d’examen avec produit de contraste.');
select pg_temp.c('Sulfamides hypoglycémiants', 'Antidiabétiques', 'A10BB',
  'Stimulent la sécrétion d’insuline par la cellule bêta pancréatique (fermeture des canaux K-ATP).',
  'Diabète de type 1 ; insuffisance rénale ou hépatique sévère ; grossesse ; association au miconazole ; porphyrie.',
  'Miconazole (contre-indiqué, hypoglycémie sévère) ; fluconazole, AINS, fluoroquinolones, fibrates (↑ hypoglycémie) ; alcool (effet antabuse, hypoglycémie) ; bêta-bloquants (masquent les signes).',
  'Risque d’hypoglycémie et de prise de poids ; prendre avec un repas et ne pas sauter de repas. Glibenclamide déconseillé chez le sujet âgé. Gliclazide : le moins à risque de la classe.');
select pg_temp.c('Glinides', 'Antidiabétiques', 'A10BX',
  'Stimulent rapidement et brièvement la sécrétion d’insuline (action courte, prise avant les repas).',
  'Diabète de type 1 ; insuffisance hépatique sévère ; association au gemfibrozil.',
  'Gemfibrozil (contre-indiqué), clopidogrel, clarithromycine (↑ répaglinide) ; rifampicine (↓).',
  'À prendre juste avant chaque repas ; en cas de repas sauté, sauter la prise. Ne pas associer aux sulfamides.');
select pg_temp.c('Inhibiteurs de la DPP-4 (gliptines)', 'Antidiabétiques', 'A10BH',
  'Inhibent la dégradation des incrétines (GLP-1, GIP) : insulinosécrétion glucose-dépendante, peu d’hypoglycémie et neutres sur le poids.',
  'Diabète de type 1 ; acidocétose ; hypersensibilité ; vildagliptine : insuffisance hépatique.',
  'Peu d’interactions ; hypoglycémies si associées à un sulfamide ou à l’insuline ; ne pas associer à un agoniste du GLP-1.',
  'Pancréatite aiguë (douleurs abdominales persistantes : arrêt), arthralgies, pemphigoïde bulleuse rares. Adapter la dose au DFG (sauf linagliptine).');
select pg_temp.c('Agonistes du récepteur du GLP-1', 'Antidiabétiques', 'A10BJ',
  'Miment le GLP-1 : insulinosécrétion glucose-dépendante, baisse du glucagon, ralentissement de la vidange gastrique et de l’appétit : perte de poids, bénéfice cardiovasculaire démontré pour certains.',
  'Antécédent de pancréatite ; antécédent personnel ou familial de cancer médullaire de la thyroïde ou NEM2 ; diabète de type 1.',
  'Retard de vidange gastrique : modifie l’absorption des médicaments oraux à marge étroite ; hypoglycémies si sulfamide ou insuline ; ne pas associer aux gliptines.',
  'Injection sous-cutanée (quotidienne ou hebdomadaire) ; nausées et vomissements en début de traitement (titration lente), constipation, lithiase biliaire. Stylos neufs au réfrigérateur ; en cours d’utilisation, température ambiante selon notice. Ne pas confondre les stylos Wegovy/Saxenda (obésité) et Ozempic/Victoza (diabète).');
select pg_temp.c('Inhibiteurs du SGLT2 (gliflozines)', 'Antidiabétiques', 'A10BK',
  'Bloquent la réabsorption rénale du glucose : glycosurie, baisse de la glycémie, du poids et de la pression artérielle ; protection cardiaque et rénale.',
  'Diabète de type 1 (risque d’acidocétose) ; acidocétose ; DFG trop bas selon la molécule pour l’effet glycémique (l’effet cardio-rénal persiste).',
  'Diurétiques (déshydratation, hypotension) ; insuline et sulfamides (hypoglycémies) ; AINS (insuffisance rénale).',
  'Mycoses génitales et infections urinaires : hygiène locale. Hydratation. Suspendre en cas de maladie aiguë, vomissements, jeûne ou 3 jours avant une chirurgie programmée (acidocétose euglycémique). Gangrène de Fournier très rare.');
select pg_temp.c('Insulines prandiales', 'Antidiabétiques', 'A10AB / A10AD',
  'Insulines à action rapide ou ultra-rapide, injectées avant les repas pour couvrir la glycémie post-prandiale.',
  'Hypoglycémie en cours.',
  'Bêta-bloquants (masquent l’hypoglycémie) ; alcool ; corticoïdes (↑ glycémie) ; hypoglycémiants.',
  'Rotation des sites d’injection, stylo personnel, aiguille neuve à chaque injection. Stocks au réfrigérateur ; en cours d’utilisation à température ambiante (≤ 30 °C) pendant 28 jours environ. Sensibiliser à la conduite à tenir en cas d’hypoglycémie : 15 g de sucre puis collation.');
select pg_temp.c('Insulines basales', 'Antidiabétiques', 'A10AE / A10AC',
  'Insulines à action prolongée, couvrant le besoin de base sur 12 à 42 heures selon la molécule.',
  'Hypoglycémie en cours.',
  'Comme les insulines prandiales ; ne pas mélanger les insulines lentes analogues dans une même seringue.',
  'Injection à heure fixe. Lantus, Toujeo et Abasaglar ne sont pas interchangeables en unités (Toujeo = 300 UI/ml). Insulines NPH : remettre en suspension avant injection.');
select pg_temp.c('Glitazones', 'Antidiabétiques', 'A10BG',
  'Activent PPAR-gamma : augmentent la sensibilité à l’insuline des tissus périphériques.',
  'Insuffisance cardiaque ou antécédent ; insuffisance hépatique ; cancer de la vessie ou hématurie non explorée ; acidocétose.',
  'Gemfibrozil (↑ pioglitazone) ; insuline (rétention hydrique, œdèmes) ; rifampicine (↓).',
  'Rétention hydrique, prise de poids, fractures chez la femme. Usage restreint (3e ligne) ; surveiller œdèmes et dyspnée.');
select pg_temp.c('Inhibiteurs des alpha-glucosidases', 'Antidiabétiques', 'A10BF',
  'Retardent l’absorption intestinale des glucides complexes : baisse de la glycémie post-prandiale.',
  'Maladies inflammatoires chroniques de l’intestin ; occlusion ; insuffisance rénale sévère.',
  'Charbon, enzymes digestives (↓ effet) ; en cas d’hypoglycémie sous acarbose, utiliser du glucose pur (pas du saccharose).',
  'Flatulences et diarrhées fréquentes ; prendre au début du repas. Peu prescrit.');
select pg_temp.c('Associations fixes antidiabétiques', 'Antidiabétiques', 'A10BD / A10AE',
  'Deux principes actifs en une prise : metformine + gliptine ou gliflozine, gliptine + gliflozine, ou insuline basale + agoniste du GLP-1.',
  'Celles de chaque composant.',
  'Celles de chaque composant.',
  'Vérifier qu’un composant n’est pas déjà apporté par un autre médicament du patient (ex. metformine). Mêmes règles de suspension que la metformine et que les gliflozines.');

select pg_temp.c('Statines', 'Hypolipémiants', 'C10AA',
  'Inhibent l’HMG-CoA réductase hépatique : baisse du LDL-cholestérol de 30 à 55 % et réduction démontrée des événements cardiovasculaires.',
  'Grossesse et allaitement ; maladie hépatique active ; myopathie ; hypersensibilité.',
  'Gemfibrozil et fibrates (rhabdomyolyse), macrolides (clarithromycine, érythromycine), azolés, ciclosporine, jus de pamplemousse (simvastatine, atorvastatine), amlodipine (simvastatine ≤ 20 mg), diltiazem/vérapamil, AVK (↑ INR).',
  'Douleurs musculaires inexpliquées, urines foncées : consulter. Simvastatine, pravastatine, fluvastatine : prise le soir ; atorvastatine et rosuvastatine : toute heure. Arrêt si grossesse. Bilan hépatique avant traitement selon contexte.');
select pg_temp.c('Inhibiteur de l’absorption du cholestérol (ézétimibe)', 'Hypolipémiants', 'C10AX09',
  'Bloque le transporteur NPC1L1 de l’intestin : baisse additionnelle du LDL-cholestérol de 15 à 20 %.',
  'En association à une statine : maladie hépatique active ; grossesse et allaitement.',
  'Ciclosporine (↑) ; colestyramine (espacer : ézétimibe 2 h avant ou 4 h après) ; fibrates.',
  'Très bien toléré. S’ajoute à une statine ou la remplace en cas d’intolérance.');
select pg_temp.c('Fibrates', 'Hypolipémiants', 'C10AB',
  'Activent PPAR-alpha : baisse des triglycérides (30–50 %), légère hausse du HDL-cholestérol.',
  'Insuffisance hépatique ou rénale sévère ; lithiase biliaire ; photosensibilité aux fibrates ; gemfibrozil + statine (contre-indiqué).',
  'Statines (myopathie, surtout gemfibrozil), AVK (↑ INR), ciclosporine, glitazones.',
  'Douleurs musculaires, lithiase biliaire, élévation de la créatinine. Fénofibrate : le plus utilisé, préférer à gemfibrozil en association à une statine.');
select pg_temp.c('Résines chélatrices des acides biliaires', 'Hypolipémiants', 'C10AC',
  'Fixent les acides biliaires dans l’intestin : augmentent le catabolisme hépatique du cholestérol.',
  'Obstruction biliaire ; hypertriglycéridémie sévère ; occlusion intestinale.',
  'Diminuent l’absorption de nombreux médicaments (AVK, digoxine, lévothyroxine, contraceptifs…) : espacer de 1 h avant ou 4 à 6 h après.',
  'Constipation, ballonnements ; déficit en vitamines liposolubles au long cours. Poudre à délayer dans un liquide.');
select pg_temp.c('Inhibiteurs de PCSK9', 'Hypolipémiants', 'C10AX13 / C10AX14 / C10AX16',
  'Empêchent la dégradation du récepteur du LDL (anticorps anti-PCSK9, ou ARN interférent pour l’inclisiran) : baisse du LDL-cholestérol de 50 à 60 %.',
  'Hypersensibilité ; pas de contre-indication métabolique majeure.',
  'Peu d’interactions ; s’ajoutent aux statines et à l’ézétimibe.',
  'Injection sous-cutanée (stylo) toutes les 2 semaines ou mensuelle ; inclisiran tous les 6 mois par un soignant. Réservés aux hypercholestérolémies familiales ou au risque très élevé non contrôlé sous traitement maximal (conditions de prise en charge à vérifier). Conservation au réfrigérateur.');
select pg_temp.c('Acide bempédoïque', 'Hypolipémiants', 'C10AX15',
  'Inhibe l’ATP-citrate lyase, en amont de l’HMG-CoA réductase : baisse du LDL-cholestérol ; activé seulement dans le foie (peu de myalgies).',
  'Grossesse et allaitement.',
  'Simvastatine > 40 mg et pravastatine > 40 mg (↑ statine) ; risque d’hyperuricémie et de tendinopathie.',
  'Alternative en cas d’intolérance aux statines. Prévenir d’une possible crise de goutte ou d’une tendinopathie.');

-- ============================ MOLÉCULES ============================
-- IEC
select pg_temp.m('ramipril', 'IEC', 'HTA ; Insuffisance cardiaque ; Prévention cardiovasculaire après infarctus ; Néphropathie', 'Dose de départ 1,25–2,5 mg, cible 10 mg/j ; bénéfice de prévention cardiovasculaire (HOPE).', 'Triatec|1,25 / 2,5 / 5 / 10 mg ; Ramipril Arrow|générique');
select pg_temp.m('périndopril', 'IEC', 'HTA ; Insuffisance cardiaque ; Coronaropathie stable', 'Existe en sels arginine et tert-butylamine (doses non équivalentes).', 'Coversyl|2,5 / 5 / 10 mg ; Périndopril Biogaran|générique');
select pg_temp.m('énalapril', 'IEC', 'HTA ; Insuffisance cardiaque', 'Prodrogue ; historique dans l’IC (CONSENSUS, SOLVD).', 'Renitec|5 / 20 mg');
select pg_temp.m('lisinopril', 'IEC', 'HTA ; Insuffisance cardiaque ; Infarctus récent', 'Éliminé sous forme inchangée par le rein : adapter à la fonction rénale.', 'Zestril|5 / 20 mg ; Prinivil|5 / 20 mg');
select pg_temp.m('captopril', 'IEC', 'HTA ; Insuffisance cardiaque', 'Plusieurs prises par jour ; dose minimale efficace la plus faible pour éviter la neutropénie et la protéinurie.', 'Lopril|25 / 50 mg');
select pg_temp.m('quinapril', 'IEC', 'HTA ; Insuffisance cardiaque', null, 'Acuitel|5 / 20 mg');
select pg_temp.m('trandolapril', 'IEC', 'HTA ; Post-infarctus avec dysfonction ventriculaire', null, 'Odrik|0,5 / 2 mg');
select pg_temp.m('fosinopril', 'IEC', 'HTA ; Insuffisance cardiaque', 'Double élimination rénale et biliaire : pas d’adaptation nécessaire en insuffisance rénale modérée.', 'Fozitec|10 / 20 mg');
-- ARA2
select pg_temp.m('losartan', 'ARA2', 'HTA ; Néphropathie du diabétique de type 2 ; Insuffisance cardiaque', 'Effet uricosurique modéré.', 'Cozaar|50 / 100 mg ; Losartan Biogaran|générique');
select pg_temp.m('valsartan', 'ARA2', 'HTA ; Insuffisance cardiaque ; Infarctus récent', null, 'Tareg|40 / 80 / 160 mg ; Nisis|40 / 80 / 160 mg');
select pg_temp.m('irbésartan', 'ARA2', 'HTA ; Néphropathie du diabétique de type 2', null, 'Aprovel|75 / 150 / 300 mg ; Karvea|75 / 150 / 300 mg');
select pg_temp.m('candésartan', 'ARA2', 'HTA ; Insuffisance cardiaque', null, 'Atacand|4 / 8 / 16 / 32 mg ; Kenzen|4 / 8 / 16 / 32 mg');
select pg_temp.m('telmisartan', 'ARA2', 'HTA ; Prévention cardiovasculaire', 'Demi-vie très longue (≈ 24 h) : oubli de prise moins pénalisant.', 'Micardis|20 / 40 / 80 mg ; Pritor|20 / 40 / 80 mg');
select pg_temp.m('olmésartan', 'ARA2', 'HTA', 'Entéropathie sprue-like très rare (diarrhée chronique sévère avec perte de poids).', 'Alteis|10 / 20 / 40 mg ; Olmetec|10 / 20 / 40 mg');
-- ARNI
select pg_temp.m('sacubitril/valsartan', 'ARNI', 'Insuffisance cardiaque chronique à FEVG réduite', 'Dosage 24/26, 49/51, 97/103 mg, 2 fois par jour ; titration par paliers.', 'Entresto|24/26 / 49/51 / 97/103 mg', 'sacubitril, valsartan');
-- DHP
select pg_temp.m('amlodipine', 'Inhibiteurs calciques dihydropyridines', 'HTA ; Angor stable', 'Demi-vie longue (30–50 h) : oubli de prise peu critique ; œdèmes des chevilles dose-dépendants.', 'Amlor|5 / 10 mg ; Amlodipine Biogaran|générique');
select pg_temp.m('nifédipine', 'Inhibiteurs calciques dihydropyridines', 'HTA ; Angor ; Menace d’accouchement prématuré (hors AMM courante) ; HTA gravidique', 'Formes LP à 1 prise/j pour l’HTA ; formes à libération immédiate à éviter (hypotension brutale).', 'Adalate LP|20 / 30 / 60 mg ; Chronadalate LP|30 / 60 mg');
select pg_temp.m('félodipine', 'Inhibiteurs calciques dihydropyridines', 'HTA ; Angor', 'Sensible au jus de pamplemousse.', 'Flodil LP|5 mg');
select pg_temp.m('lercanidipine', 'Inhibiteurs calciques dihydropyridines', 'HTA', 'Moins d’œdèmes que l’amlodipine ; à prendre avant un repas.', 'Lercan|10 / 20 mg ; Zanidip|10 / 20 mg');
select pg_temp.m('lacidipine', 'Inhibiteurs calciques dihydropyridines', 'HTA', null, 'Caldine|2 / 4 mg');
select pg_temp.m('nicardipine', 'Inhibiteurs calciques dihydropyridines', 'HTA ; Angor', null, 'Loxen LP|50 mg');
select pg_temp.m('isradipine', 'Inhibiteurs calciques dihydropyridines', 'HTA', null, 'Icaz LP|5 mg');
-- non DHP
select pg_temp.m('vérapamil', 'Inhibiteurs calciques non dihydropyridines', 'HTA ; Angor ; Troubles du rythme supraventriculaire', 'Constipation fréquente ; contre-indiqué avec les bêta-bloquants.', 'Isoptine|40 / 120 / 240 mg');
select pg_temp.m('diltiazem', 'Inhibiteurs calciques non dihydropyridines', 'HTA ; Angor ; Fibrillation atriale (contrôle de la fréquence)', 'Inhibiteur du CYP3A4 (↑ simvastatine, ciclosporine).', 'Tildiem|60 mg ; Tildiem LP|200 / 300 mg');
-- thiazidiques
select pg_temp.m('hydrochlorothiazide', 'Diurétiques thiazidiques et apparentés', 'HTA ; Œdèmes', 'Surtout utilisé en association fixe ; risque de cancers cutanés non mélaniques (photoprotection).', 'Esidrex|25 mg');
select pg_temp.m('indapamide', 'Diurétiques thiazidiques et apparentés', 'HTA', 'Forme LP 1,5 mg à 1 prise/j ; hypokaliémie dose-dépendante moindre ; peut allonger le QT.', 'Fludex LP|1,5 mg ; Fludex|2,5 mg');
select pg_temp.m('chlortalidone', 'Diurétiques thiazidiques et apparentés', 'HTA ; Œdèmes', 'Longue demi-vie.', 'Hygroton|50 mg');
-- anse
select pg_temp.m('furosémide', 'Diurétiques de l’anse', 'Œdèmes (insuffisance cardiaque, cirrhose, syndrome néphrotique) ; HTA avec insuffisance rénale', 'Action en 30 min per os, durée 4–6 h ; ototoxicité à forte dose IV rapide.', 'Lasilix|40 mg ; Lasilix Retard|60 mg ; Lasilix Spécial|500 mg');
select pg_temp.m('bumétanide', 'Diurétiques de l’anse', 'Œdèmes ; Insuffisance cardiaque', 'Environ 40 fois plus puissant que le furosémide en poids.', 'Burinex|1 / 5 mg');
-- ARM
select pg_temp.m('spironolactone', 'Antagonistes des récepteurs minéralocorticoïdes (ARM)', 'Insuffisance cardiaque à FEVG réduite ; HTA résistante ; Hyperaldostéronisme ; Œdèmes de cirrhose', 'Gynécomastie et troubles menstruels possibles ; hyperkaliémie.', 'Aldactone|25 / 50 / 75 mg ; Spironolactone Biogaran|générique');
select pg_temp.m('éplérénone', 'Antagonistes des récepteurs minéralocorticoïdes (ARM)', 'Insuffisance cardiaque post-infarctus ; Insuffisance cardiaque à FEVG réduite', 'Pas d’effets endocriniens ; contre-indiquée avec les inhibiteurs puissants du CYP3A4.', 'Inspra|25 / 50 mg');
-- BB
select pg_temp.m('bisoprolol', 'Bêta-bloquants', 'HTA ; Angor ; Insuffisance cardiaque chronique ; Fibrillation atriale (fréquence)', 'Bêta-1 sélectif ; un des 4 bêta-bloquants de l’insuffisance cardiaque.', 'Cardensiel|1,25 / 2,5 / 3,75 / 5 / 7,5 / 10 mg ; Detensiel|1,25 / 2,5 / 5 / 10 mg');
select pg_temp.m('nébivolol', 'Bêta-bloquants', 'HTA ; Insuffisance cardiaque du sujet âgé', 'Bêta-1 sélectif avec effet vasodilatateur (NO).', 'Temerit|5 mg ; Nebilox|5 mg');
select pg_temp.m('métoprolol', 'Bêta-bloquants', 'HTA ; Angor ; Post-infarctus ; Migraine (prévention)', 'Succinate LP : indiqué dans l’insuffisance cardiaque ; métabolisé par le CYP2D6.', 'Lopressor|100 mg ; Seloken LP|100 / 200 mg');
select pg_temp.m('aténolol', 'Bêta-bloquants', 'HTA ; Angor ; Post-infarctus', 'Hydrophile, élimination rénale : adapter au DFG.', 'Ténormine|50 / 100 mg');
select pg_temp.m('propranolol', 'Bêta-bloquants', 'HTA ; Tremblement essentiel ; Migraine (prévention) ; Hémangiome du nourrisson', 'Non sélectif, lipophile : CI asthme ; passe la barrière hémato-encéphalique.', 'Avlocardyl|40 / 160 mg');
select pg_temp.m('carvédilol', 'Bêta-bloquants', 'Insuffisance cardiaque chronique ; HTA', 'Non sélectif avec effet alpha-1 : hypotension orthostatique possible ; un des 4 bêta-bloquants de l’IC.', 'Kredex|6,25 / 12,5 / 25 mg');
select pg_temp.m('acébutolol', 'Bêta-bloquants', 'HTA ; Angor ; Troubles du rythme', 'Bêta-1 sélectif avec activité sympathomimétique intrinsèque.', 'Sectral|200 / 400 mg');
select pg_temp.m('labétalol', 'Bêta-bloquants', 'HTA gravidique ; Urgences hypertensives', 'Effet alpha et bêta : antihypertenseur de référence de la grossesse.', 'Trandate|200 mg');
-- centraux
select pg_temp.m('moxonidine', 'Antihypertenseurs centraux', 'HTA (recours)', null, 'Physiotens|0,2 / 0,4 mg');
select pg_temp.m('rilménidine', 'Antihypertenseurs centraux', 'HTA (recours)', null, 'Hyperium|1 mg');
select pg_temp.m('clonidine', 'Antihypertenseurs centraux', 'HTA (recours)', 'Arrêt brutal : HTA rebond.', 'Catapressan|0,15 mg');
select pg_temp.m('méthyldopa', 'Antihypertenseurs centraux', 'HTA gravidique ; HTA (recours)', 'Utilisable pendant la grossesse ; effets : somnolence, anémie hémolytique rare.', 'Aldomet|250 mg');
-- alpha
select pg_temp.m('urapidil', 'Alpha-bloquants', 'HTA (recours) ; Urgences hypertensives', 'Alpha-1 + agoniste central 5-HT1A.', 'Eupressyl|30 / 60 mg LP');
select pg_temp.m('doxazosine', 'Alpha-bloquants', 'HTA (recours) ; Hypertrophie bénigne de la prostate', 'Hypotension orthostatique : 1re prise au coucher.', 'Zoxan LP|4 mg ; Cardura|2 mg');
-- associations HTA
select pg_temp.m('périndopril/indapamide', 'Associations fixes antihypertensives', 'HTA', 'Bithérapie IEC + diurétique à 1 prise par jour.', 'Preterax|2,5/0,625 mg ; Bipreterax|5/1,25 / 10/2,5 mg', 'périndopril, indapamide');
select pg_temp.m('périndopril/amlodipine', 'Associations fixes antihypertensives', 'HTA ; Coronaropathie stable', 'Bithérapie IEC + inhibiteur calcique.', 'Coveram|5/5 / 5/10 / 10/5 / 10/10 mg', 'périndopril, amlodipine');
select pg_temp.m('périndopril/indapamide/amlodipine', 'Associations fixes antihypertensives', 'HTA', 'Trithérapie en un comprimé (IEC + diurétique + inhibiteur calcique).', 'Triplixam|5/1,25/5 / 5/1,25/10 / 10/2,5/5 / 10/2,5/10 mg', 'périndopril, indapamide, amlodipine');
select pg_temp.m('valsartan/amlodipine', 'Associations fixes antihypertensives', 'HTA', null, 'Exforge|5/80 / 5/160 / 10/160 mg', 'valsartan, amlodipine');
select pg_temp.m('valsartan/hydrochlorothiazide', 'Associations fixes antihypertensives', 'HTA', null, 'Cotareg|80/12,5 / 160/12,5 mg ; Nisisco|80/12,5 / 160/12,5 mg', 'valsartan, hydrochlorothiazide');
select pg_temp.m('valsartan/amlodipine/hydrochlorothiazide', 'Associations fixes antihypertensives', 'HTA', 'Trithérapie en un comprimé.', 'Exforge HCT|5/160/12,5 mg', 'valsartan, amlodipine, hydrochlorothiazide');
select pg_temp.m('irbésartan/hydrochlorothiazide', 'Associations fixes antihypertensives', 'HTA', null, 'Coaprovel|150/12,5 / 300/12,5 mg', 'irbésartan, hydrochlorothiazide');
select pg_temp.m('losartan/hydrochlorothiazide', 'Associations fixes antihypertensives', 'HTA', null, 'Hyzaar|50/12,5 / 100/25 mg', 'losartan, hydrochlorothiazide');
select pg_temp.m('candésartan/hydrochlorothiazide', 'Associations fixes antihypertensives', 'HTA', null, 'Hytacand|8/12,5 / 16/12,5 mg ; Cokenzen|8/12,5 mg', 'candésartan, hydrochlorothiazide');
select pg_temp.m('olmésartan/amlodipine', 'Associations fixes antihypertensives', 'HTA', null, 'Axeler|20/5 / 40/5 / 40/10 mg ; Sevikar|20/5 / 40/5 mg', 'olmésartan, amlodipine');
select pg_temp.m('olmésartan/hydrochlorothiazide', 'Associations fixes antihypertensives', 'HTA', null, 'Alteisduo|20/12,5 / 40/12,5 mg ; CoOlmetec|20/12,5 mg', 'olmésartan, hydrochlorothiazide');
select pg_temp.m('telmisartan/amlodipine', 'Associations fixes antihypertensives', 'HTA', null, 'Twynsta|40/5 / 40/10 / 80/5 / 80/10 mg', 'telmisartan, amlodipine');
select pg_temp.m('telmisartan/hydrochlorothiazide', 'Associations fixes antihypertensives', 'HTA', null, 'MicardisPlus|40/12,5 / 80/12,5 mg ; Pritorplus|40/12,5 / 80/12,5 mg', 'telmisartan, hydrochlorothiazide');
select pg_temp.m('ramipril/hydrochlorothiazide', 'Associations fixes antihypertensives', 'HTA', null, 'Cotriatec|5/12,5 mg', 'ramipril, hydrochlorothiazide');
select pg_temp.m('bisoprolol/hydrochlorothiazide', 'Associations fixes antihypertensives', 'HTA', null, 'Lodoz|2,5/6,25 / 5/6,25 / 10/6,25 mg ; Wytens|2,5/6,25 / 5/6,25 mg', 'bisoprolol, hydrochlorothiazide');
-- Autres cardio
select pg_temp.m('ivabradine', 'Inhibiteur du courant If (ivabradine)', 'Angor stable ; Insuffisance cardiaque à FEVG réduite avec FC ≥ 70/min en rythme sinusal', 'Phosphènes ; ne réduit que la fréquence cardiaque.', 'Procoralan|5 / 7,5 mg ; Corlentor|5 / 7,5 mg');
select pg_temp.m('digoxine', 'Digitaliques', 'Fibrillation atriale (contrôle de la fréquence) ; Insuffisance cardiaque', 'Marge thérapeutique étroite ; signes de toxicité : nausées, vision jaune, bradycardie.', 'Digoxine Nativelle|0,25 mg ; Digoxine Nativelle Pédiatrique|0,05 mg/ml');
select pg_temp.m('vericiguat', 'Stimulateur de la guanylate cyclase soluble', 'Insuffisance cardiaque à FEVG réduite après aggravation récente', 'Tératogène ; contre-indiqué avec les inhibiteurs de la PDE5.', 'Verquvo|2,5 / 5 / 10 mg');
select pg_temp.m('amiodarone', 'Antiarythmiques', 'Fibrillation atriale (rythme) ; Tachycardie ventriculaire', 'Iodée, demi-vie de plusieurs semaines ; dysthyroïdies, photosensibilité, pneumopathie ; ↑ INR sous AVK.', 'Cordarone|200 mg ; Amiodarone Biogaran|générique');
select pg_temp.m('flécaïnide', 'Antiarythmiques', 'Fibrillation atriale (rythme, cœur structurellement sain) ; Tachycardies supraventriculaires', 'Contre-indiqué en cas de cardiopathie ischémique ou structurelle.', 'Flécaïne|100 mg ; Flécaïne LP|100 / 150 mg');
select pg_temp.m('sotalol', 'Antiarythmiques', 'Fibrillation atriale (rythme) ; Tachycardie ventriculaire', 'Bêta-bloquant avec allongement du QT : risque de torsades de pointes.', 'Sotalex|80 / 160 mg');
select pg_temp.m('dronédarone', 'Antiarythmiques', 'Fibrillation atriale paroxystique ou persistante (maintien du rythme sinusal)', 'Contre-indiquée en cas d’insuffisance cardiaque NYHA III–IV ou de FA permanente ; hépatotoxicité.', 'Multaq|400 mg');
select pg_temp.m('propafénone', 'Antiarythmiques', 'Fibrillation atriale (cœur sain) ; Tachycardies supraventriculaires', null, 'Rythmol|150 / 300 mg');
-- AOD
select pg_temp.m('apixaban', 'Anticoagulants oraux directs (AOD)', 'Fibrillation atriale non valvulaire ; Maladie thromboembolique veineuse ; Prévention après prothèse de hanche ou de genou', 'FA : 5 mg × 2/j ; 2,5 mg × 2/j si ≥ 2 critères parmi âge ≥ 80 ans, poids ≤ 60 kg, créatininémie ≥ 133 µmol/l. Moins de saignements digestifs ; élimination rénale ≈ 27 %.', 'Eliquis|2,5 / 5 mg');
select pg_temp.m('rivaroxaban', 'Anticoagulants oraux directs (AOD)', 'Fibrillation atriale non valvulaire ; Maladie thromboembolique veineuse ; Prévention après chirurgie orthopédique ; Coronaropathie', 'FA : 20 mg/j (15 mg si DFG 15–49) pendant un repas.', 'Xarelto|2,5 / 10 / 15 / 20 mg');
select pg_temp.m('dabigatran', 'Anticoagulants oraux directs (AOD)', 'Fibrillation atriale non valvulaire ; Maladie thromboembolique veineuse', 'Élimination rénale ≈ 80 % : contre-indiqué si DFG < 30 ; gélules à garder dans le flacon d’origine (humidité) ; dyspepsie fréquente ; antidote : idarucizumab.', 'Pradaxa|75 / 110 / 150 mg');
select pg_temp.m('edoxaban', 'Anticoagulants oraux directs (AOD)', 'Fibrillation atriale non valvulaire ; Maladie thromboembolique veineuse', '60 mg/j ; 30 mg/j si DFG 15–50, poids ≤ 60 kg ou inhibiteur de la P-gp.', 'Lixiana|15 / 30 / 60 mg');
-- AVK
select pg_temp.m('warfarine', 'Antivitamines K (AVK)', 'Fibrillation atriale valvulaire ; Prothèse valvulaire mécanique ; Maladie thromboembolique veineuse', 'Demi-vie ≈ 35–45 h ; posologie adaptée à l’INR.', 'Coumadine|2 / 5 mg');
select pg_temp.m('fluindione', 'Antivitamines K (AVK)', 'Fibrillation atriale valvulaire ; Prothèse valvulaire mécanique ; Maladie thromboembolique veineuse', 'Demi-vie ≈ 31 h, AVK le plus prescrit en France ; réactions immuno-allergiques rares.', 'Préviscan|20 mg');
select pg_temp.m('acénocoumarol', 'Antivitamines K (AVK)', 'Fibrillation atriale valvulaire ; Prothèse valvulaire mécanique ; Maladie thromboembolique veineuse', 'Demi-vie courte (8–11 h) : INR plus instable, parfois 2 prises par jour.', 'Sintrom|4 mg ; Minisintrom|1 mg');

-- Diabète
select pg_temp.m('metformine', 'Biguanides', 'Diabète de type 2 (1re ligne) ; Prédiabète à haut risque (hors AMM courante)', 'Pas de prise de poids ; max 3 g/j (1 g si DFG 30–45) ; contre-indiquée si DFG < 30.', 'Glucophage|500 / 850 / 1000 mg ; Stagid|700 mg ; Metformine Biogaran|générique');
select pg_temp.m('gliclazide', 'Sulfamides hypoglycémiants', 'Diabète de type 2', 'Sulfamide le moins à risque d’hypoglycémie sévère ; forme LM 30/60 mg à 1 prise le matin avec le petit-déjeuner.', 'Diamicron|30 / 60 mg LM ; Gliclazide Biogaran|générique');
select pg_temp.m('glimépiride', 'Sulfamides hypoglycémiants', 'Diabète de type 2', '1 prise par jour au petit-déjeuner.', 'Amarel|1 / 2 / 3 / 4 mg');
select pg_temp.m('glibenclamide', 'Sulfamides hypoglycémiants', 'Diabète de type 2', 'Hypoglycémies plus fréquentes et prolongées : déconseillé chez le sujet âgé.', 'Daonil|5 mg ; Hémi-Daonil|2,5 mg');
select pg_temp.m('glipizide', 'Sulfamides hypoglycémiants', 'Diabète de type 2', null, 'Minidiab|5 mg ; Glibénèse|5 mg');
select pg_temp.m('répaglinide', 'Glinides', 'Diabète de type 2', '3 prises par jour, 15 min avant les repas ; contre-indiqué avec le gemfibrozil.', 'Novonorm|0,5 / 1 / 2 mg');
select pg_temp.m('sitagliptine', 'Inhibiteurs de la DPP-4 (gliptines)', 'Diabète de type 2', '100 mg/j ; 50 mg si DFG 30–45 ; 25 mg si DFG < 30.', 'Januvia|25 / 50 / 100 mg ; Xelevia|25 / 50 / 100 mg');
select pg_temp.m('vildagliptine', 'Inhibiteurs de la DPP-4 (gliptines)', 'Diabète de type 2', '50 mg × 2/j ; bilan hépatique avant traitement.', 'Galvus|50 mg');
select pg_temp.m('saxagliptine', 'Inhibiteurs de la DPP-4 (gliptines)', 'Diabète de type 2', 'Augmentation du risque d’hospitalisation pour insuffisance cardiaque (SAVOR).', 'Onglyza|2,5 / 5 mg');
select pg_temp.m('linagliptine', 'Inhibiteurs de la DPP-4 (gliptines)', 'Diabète de type 2', 'Élimination non rénale : pas d’adaptation de dose à la fonction rénale.', 'Trajenta|5 mg');
select pg_temp.m('alogliptine', 'Inhibiteurs de la DPP-4 (gliptines)', 'Diabète de type 2', null, 'Vipidia|6,25 / 12,5 / 25 mg');
select pg_temp.m('liraglutide', 'Agonistes du récepteur du GLP-1', 'Diabète de type 2 ; Obésité (Saxenda)', 'Injection quotidienne ; bénéfice cardiovasculaire (LEADER).', 'Victoza|1,2 / 1,8 mg ; Saxenda|3 mg (obésité)');
select pg_temp.m('dulaglutide', 'Agonistes du récepteur du GLP-1', 'Diabète de type 2', 'Injection hebdomadaire ; bénéfice cardiovasculaire (REWIND).', 'Trulicity|0,75 / 1,5 / 3 / 4,5 mg');
select pg_temp.m('sémaglutide', 'Agonistes du récepteur du GLP-1', 'Diabète de type 2 (Ozempic, Rybelsus) ; Obésité (Wegovy)', 'Injection hebdomadaire ou comprimé quotidien à jeun (Rybelsus) ; bénéfice cardiovasculaire (SUSTAIN-6).', 'Ozempic|0,25 / 0,5 / 1 / 2 mg ; Rybelsus|3 / 7 / 14 mg ; Wegovy|0,25–2,4 mg (obésité)');
select pg_temp.m('exénatide', 'Agonistes du récepteur du GLP-1', 'Diabète de type 2', 'Byetta : 2 injections/j ; Bydureon : 1 injection par semaine.', 'Byetta|5 / 10 µg ; Bydureon|2 mg');
select pg_temp.m('tirzépatide', 'Agonistes du récepteur du GLP-1', 'Diabète de type 2 ; Obésité', 'Agoniste double GIP/GLP-1 : perte de poids plus marquée ; injection hebdomadaire.', 'Mounjaro|2,5 / 5 / 7,5 / 10 / 12,5 / 15 mg');
select pg_temp.m('dapagliflozine', 'Inhibiteurs du SGLT2 (gliflozines)', 'Diabète de type 2 ; Insuffisance cardiaque (toutes FEVG) ; Insuffisance rénale chronique', 'Une des 4 classes de l’insuffisance cardiaque à FEVG réduite ; 10 mg/j.', 'Forxiga|5 / 10 mg');
select pg_temp.m('empagliflozine', 'Inhibiteurs du SGLT2 (gliflozines)', 'Diabète de type 2 ; Insuffisance cardiaque (toutes FEVG) ; Insuffisance rénale chronique', 'Réduction de la mortalité cardiovasculaire dans le diabète de type 2 à haut risque (EMPA-REG).', 'Jardiance|10 / 25 mg');
select pg_temp.m('canagliflozine', 'Inhibiteurs du SGLT2 (gliflozines)', 'Diabète de type 2', 'Risque d’amputation des membres inférieurs signalé.', 'Invokana|100 / 300 mg');
select pg_temp.m('insuline asparte', 'Insulines prandiales', 'Diabète de type 1 ; Diabète de type 2 insulino-requérant', 'Analogue rapide : à injecter 0–10 min avant le repas ; Fiasp est ultra-rapide.', 'NovoRapid|100 UI/ml ; Fiasp|100 UI/ml');
select pg_temp.m('insuline lispro', 'Insulines prandiales', 'Diabète de type 1 ; Diabète de type 2 insulino-requérant', 'Analogue rapide, à injecter juste avant le repas.', 'Humalog|100 / 200 UI/ml ; Admelog|100 UI/ml ; Lyumjev|100 UI/ml');
select pg_temp.m('insuline glulisine', 'Insulines prandiales', 'Diabète de type 1 ; Diabète de type 2 insulino-requérant', null, 'Apidra|100 UI/ml');
select pg_temp.m('insuline humaine rapide', 'Insulines prandiales', 'Diabète de type 1 ; Diabète de type 2 insulino-requérant ; Perfusion en soins aigus', 'À injecter 30 min avant le repas.', 'Actrapid|100 UI/ml ; Umuline Rapide|100 UI/ml');
select pg_temp.m('insuline glargine', 'Insulines basales', 'Diabète de type 1 ; Diabète de type 2', 'Action ≈ 24 h (Toujeo 300 UI/ml jusqu’à 36 h) ; Abasaglar et Semglee : biosimilaires.', 'Lantus|100 UI/ml ; Toujeo|300 UI/ml ; Abasaglar|100 UI/ml ; Semglee|100 UI/ml');
select pg_temp.m('insuline détémir', 'Insulines basales', 'Diabète de type 1 ; Diabète de type 2', 'Action ≈ 12–24 h ; parfois 2 injections par jour.', 'Levemir|100 UI/ml');
select pg_temp.m('insuline dégludec', 'Insulines basales', 'Diabète de type 1 ; Diabète de type 2', 'Action > 42 h : horaire d’injection plus souple.', 'Tresiba|100 / 200 UI/ml');
select pg_temp.m('insuline humaine NPH', 'Insulines basales', 'Diabète de type 1 ; Diabète de type 2', 'Suspension à remettre en mélange avant injection ; pic d’action à 4–8 h.', 'Insulatard|100 UI/ml ; Umuline NPH|100 UI/ml');
select pg_temp.m('pioglitazone', 'Glitazones', 'Diabète de type 2 (3e ligne)', 'Rétention hydrique, fractures, cancer de la vessie : surveillance hématurie.', 'Actos|15 / 30 / 45 mg');
select pg_temp.m('acarbose', 'Inhibiteurs des alpha-glucosidases', 'Diabète de type 2', 'À prendre au début du repas ; hypoglycémie : glucose pur.', 'Glucor|50 / 100 mg');
select pg_temp.m('metformine/sitagliptine', 'Associations fixes antidiabétiques', 'Diabète de type 2', 'À prendre pendant les repas.', 'Janumet|50/850 / 50/1000 mg ; Velmetia|50/850 / 50/1000 mg', 'metformine, sitagliptine');
select pg_temp.m('metformine/vildagliptine', 'Associations fixes antidiabétiques', 'Diabète de type 2', null, 'Eucreas|50/850 / 50/1000 mg', 'metformine, vildagliptine');
select pg_temp.m('metformine/saxagliptine', 'Associations fixes antidiabétiques', 'Diabète de type 2', null, 'Komboglyze|2,5/850 / 2,5/1000 mg', 'metformine, saxagliptine');
select pg_temp.m('metformine/linagliptine', 'Associations fixes antidiabétiques', 'Diabète de type 2', null, 'Jentadueto|2,5/850 / 2,5/1000 mg', 'metformine, linagliptine');
select pg_temp.m('dapagliflozine/metformine', 'Associations fixes antidiabétiques', 'Diabète de type 2', null, 'Xigduo|5/850 / 5/1000 mg', 'dapagliflozine, metformine');
select pg_temp.m('empagliflozine/metformine', 'Associations fixes antidiabétiques', 'Diabète de type 2', null, 'Synjardy|5/850 / 5/1000 / 12,5/850 / 12,5/1000 mg', 'empagliflozine, metformine');
select pg_temp.m('empagliflozine/linagliptine', 'Associations fixes antidiabétiques', 'Diabète de type 2', null, 'Glyxambi|10/5 / 25/5 mg', 'empagliflozine, linagliptine');
select pg_temp.m('dapagliflozine/saxagliptine', 'Associations fixes antidiabétiques', 'Diabète de type 2', null, 'Qtern|10/5 mg', 'dapagliflozine, saxagliptine');
select pg_temp.m('metformine/glibenclamide', 'Associations fixes antidiabétiques', 'Diabète de type 2', 'Cumule les contre-indications et le risque d’hypoglycémie du sulfamide.', 'Glucovance|400/2,5 / 500/2,5 / 500/5 mg', 'metformine, glibenclamide');
select pg_temp.m('insuline glargine/lixisénatide', 'Associations fixes antidiabétiques', 'Diabète de type 2', 'Stylo à doses variables ; ne pas associer à un autre GLP-1.', 'Suliqua|100/33 / 100/50 UI/µg', 'insuline glargine, lixisénatide');
select pg_temp.m('insuline dégludec/liraglutide', 'Associations fixes antidiabétiques', 'Diabète de type 2', null, 'Xultophy|100 UI/3,6 mg/ml', 'insuline dégludec, liraglutide');

-- Dyslipidémies
select pg_temp.m('atorvastatine', 'Statines', 'Hypercholestérolémie ; Prévention cardiovasculaire', 'Forte intensité à 40–80 mg (LDL ↓ ≈ 50 %) ; prise à toute heure ; sensible au CYP3A4 et au pamplemousse.', 'Tahor|10 / 20 / 40 / 80 mg ; Atorvastatine Biogaran|générique');
select pg_temp.m('rosuvastatine', 'Statines', 'Hypercholestérolémie ; Prévention cardiovasculaire', 'Forte intensité à 20–40 mg ; 5 mg chez l’insuffisant rénal sévère et 40 mg contre-indiqué en cas d’insuffisance rénale modérée ; prise à toute heure ; origine asiatique : débuter à 5 mg.', 'Crestor|5 / 10 / 20 / 40 mg ; Rosuvastatine Biogaran|générique');
select pg_temp.m('simvastatine', 'Statines', 'Hypercholestérolémie ; Prévention cardiovasculaire', 'Intensité modérée ; dose de 80 mg déconseillée (myopathie) ; prise le soir ; nombreuses interactions CYP3A4.', 'Zocor|10 / 20 / 40 mg ; Lodalès|10 / 20 / 40 mg');
select pg_temp.m('pravastatine', 'Statines', 'Hypercholestérolémie ; Prévention cardiovasculaire', 'Hydrophile, peu d’interactions CYP ; prise le soir ; utile chez le polymédiqué et en cas d’intolérance.', 'Elisor|10 / 20 / 40 mg ; Vasten|10 / 20 / 40 mg');
select pg_temp.m('fluvastatine', 'Statines', 'Hypercholestérolémie', 'Intensité faible à modérée ; métabolisme CYP2C9.', 'Fractal|20 / 40 mg ; Fractal LP|80 mg');
select pg_temp.m('pitavastatine', 'Statines', 'Hypercholestérolémie', 'Peu d’interactions CYP3A4.', 'Livazo|1 / 2 / 4 mg');
select pg_temp.m('ézétimibe', 'Inhibiteur de l’absorption du cholestérol (ézétimibe)', 'Hypercholestérolémie (en association à une statine ou seul en cas d’intolérance)', '10 mg/j, toute heure ; LDL ↓ 15–20 % en plus de la statine.', 'Ezetrol|10 mg ; Ézétimibe Biogaran|générique');
select pg_temp.m('ézétimibe/simvastatine', 'Inhibiteur de l’absorption du cholestérol (ézétimibe)', 'Hypercholestérolémie', 'Association fixe ; prise le soir ; mêmes précautions que la simvastatine.', 'Inegy|10/20 / 10/40 / 10/80 mg', 'ézétimibe, simvastatine');
select pg_temp.m('fénofibrate', 'Fibrates', 'Hypertriglycéridémie ; Dyslipidémie mixte', 'Le plus utilisé des fibrates ; ↑ INR sous AVK ; à prendre avec un repas.', 'Lipanthyl|67 / 100 / 145 / 160 / 200 mg ; Sécalip|300 mg');
select pg_temp.m('bézafibrate', 'Fibrates', 'Hypertriglycéridémie ; Dyslipidémie mixte', null, 'Befizal|200 mg ; Befizal LP|400 mg');
select pg_temp.m('ciprofibrate', 'Fibrates', 'Hypertriglycéridémie ; Dyslipidémie mixte', null, 'Lipanor|100 mg');
select pg_temp.m('gemfibrozil', 'Fibrates', 'Hypertriglycéridémie', 'Association aux statines contre-indiquée (rhabdomyolyse).', 'Lipur|450 / 900 mg');
select pg_temp.m('colestyramine', 'Résines chélatrices des acides biliaires', 'Hypercholestérolémie ; Prurit de cholestase ; Diarrhée biliaire', 'Sachets de 4 g à délayer ; espacer de 1 h avant ou 4–6 h après les autres médicaments.', 'Questran|4 g');
select pg_temp.m('colésévélam', 'Résines chélatrices des acides biliaires', 'Hypercholestérolémie', 'Comprimés ; moins d’interactions que la colestyramine.', 'Cholestagel|625 mg');
select pg_temp.m('alirocumab', 'Inhibiteurs de PCSK9', 'Hypercholestérolémie familiale ; Hypercholestérolémie non contrôlée sous traitement maximal', 'Anticorps monoclonal : 75 ou 150 mg toutes les 2 semaines, 300 mg/mois.', 'Praluent|75 / 150 / 300 mg');
select pg_temp.m('évolocumab', 'Inhibiteurs de PCSK9', 'Hypercholestérolémie familiale ; Hypercholestérolémie non contrôlée sous traitement maximal', 'Anticorps monoclonal : 140 mg toutes les 2 semaines ou 420 mg/mois.', 'Repatha|140 / 420 mg');
select pg_temp.m('inclisiran', 'Inhibiteurs de PCSK9', 'Hypercholestérolémie non contrôlée sous traitement maximal', 'ARN interférent : injection à J0, J90 puis tous les 6 mois par un soignant.', 'Leqvio|284 mg');
select pg_temp.m('acide bempédoïque', 'Acide bempédoïque', 'Hypercholestérolémie (intolérance aux statines ou en complément)', '180 mg/j ; hyperuricémie et tendinopathies possibles.', 'Nilemdo|180 mg');
select pg_temp.m('acide bempédoïque/ézétimibe', 'Acide bempédoïque', 'Hypercholestérolémie (intolérance aux statines ou en complément)', 'Association fixe.', 'Nustendi|180/10 mg', 'acide bempédoïque, ézétimibe');

-- ============================ PATHOLOGIES ============================

select pg_temp.p('Hypertension artérielle',
  'HTA confirmée (≥ 140/90 mmHg au cabinet, confirmée par automesure ou MAPA). Cinq classes de 1re intention : IEC, ARA2, inhibiteurs calciques dihydropyridines, thiazidiques et apparentés, bêta-bloquants (ces derniers surtout en cas d’indication cardiaque). Les recommandations européennes récentes privilégient une bithérapie d’emblée en un comprimé. Objectif usuel < 140/90 mmHg, idéalement 120–130/70–79 mmHg si bien toléré (< 65 ans).',
  'HAS – Prise en charge de l’HTA de l’adulte (2016) ; ESH 2023 ; ESC 2024', '2016 / 2023 / 2024');
select pg_temp.p('Diabète de type 2',
  'Objectif d’HbA1c ≈ ≤ 7 % chez la plupart des adultes (personnaliser : 7–8 % chez le sujet âgé fragile). Mesures hygiéno-diététiques et activité physique en base. La metformine reste le traitement initial. Le choix de la 2e classe dépend du profil : maladie cardiovasculaire, insuffisance cardiaque, maladie rénale, obésité, risque d’hypoglycémie.',
  'HAS – Stratégie thérapeutique du patient vivant avec un diabète de type 2 (actualisation 2024) ; ADA/EASD 2022–2025 ; SFD', '2024');
select pg_temp.p('Dyslipidémies (hypercholestérolémie)',
  'Le traitement dépend du risque cardiovasculaire global. Objectifs de LDL-cholestérol (ESC/EAS) : risque très élevé < 0,55 g/l et baisse ≥ 50 % ; risque élevé < 0,70 g/l ; risque modéré < 1,00 g/l ; risque faible < 1,16 g/l. Statine en 1re intention ; escalade par ézétimibe puis anti-PCSK9 si l’objectif n’est pas atteint.',
  'ESC/EAS – Recommandations dyslipidémies (2019) ; HAS / SFC (2017)', '2019');
select pg_temp.p('Insuffisance cardiaque à FEVG réduite',
  'Insuffisance cardiaque avec FEVG ≤ 40 %. Le traitement repose sur 4 classes à introduire rapidement et à titrer : inhibiteur du système rénine-angiotensine (ARNI de préférence, sinon IEC ou ARA2), bêta-bloquant, ARM et inhibiteur du SGLT2. Les diurétiques de l’anse traitent la congestion.',
  'ESC – Recommandations insuffisance cardiaque (2021, mise à jour 2023)', '2021 / 2023');
select pg_temp.p('Fibrillation atriale',
  'Prévention thromboembolique selon le score CHA₂DS₂-VA (ESC 2024) : anticoagulation recommandée si score ≥ 2, à envisager si score = 1. Les AOD sont préférés aux AVK, sauf sténose mitrale modérée à sévère ou prothèse valvulaire mécanique. Puis contrôle de la fréquence et/ou du rythme selon symptômes.',
  'ESC – Recommandations fibrillation atriale (2024)', '2024');

-- ============================ PROTOCOLES : HTA ============================
select pg_temp.l('Hypertension artérielle', 'Général', 1, 'Initiation : bithérapie (association fixe en 1 comprimé), ou monothérapie si HTA grade 1 à faible risque ou sujet fragile', 'Associer un IEC ou un ARA2 à un inhibiteur calcique (DHP) ou à un diurétique thiazidique/apparenté. Réévaluer à 1 mois.');
select pg_temp.i('Hypertension artérielle', 'Général', 1, 'traitement', 'IEC', 'ou ARA2 (intolérance aux IEC : toux)');
select pg_temp.i('Hypertension artérielle', 'Général', 1, 'traitement', 'ARA2', 'à choisir à la place de l’IEC, jamais les deux');
select pg_temp.i('Hypertension artérielle', 'Général', 1, 'association', 'Inhibiteurs calciques dihydropyridines', 'partenaire de l’IEC/ARA2 ; œdèmes possibles');
select pg_temp.i('Hypertension artérielle', 'Général', 1, 'association', 'Diurétiques thiazidiques et apparentés', 'partenaire de l’IEC/ARA2 ; surveiller natrémie et kaliémie');
select pg_temp.i('Hypertension artérielle', 'Général', 1, 'eviter', 'IEC', 'pas d’association IEC + ARA2 (double blocage : hyperkaliémie, insuffisance rénale)');
select pg_temp.i('Hypertension artérielle', 'Général', 1, 'eviter', 'Bêta-bloquants', 'pas de bêta-bloquant seul en 1re intention sans indication cardiaque (angor, post-infarctus, IC, FA)');
select pg_temp.l('Hypertension artérielle', 'Général', 2, 'Trithérapie si HTA non contrôlée sous bithérapie', 'IEC ou ARA2 + inhibiteur calcique + diurétique thiazidique, à doses optimales, de préférence en association fixe (1 comprimé).');
select pg_temp.i('Hypertension artérielle', 'Général', 2, 'traitement', 'Associations fixes antihypertensives', 'ex. périndopril/indapamide/amlodipine');
select pg_temp.i('Hypertension artérielle', 'Général', 2, 'eviter', 'Inhibiteurs calciques non dihydropyridines', 'pas de bêta-bloquant + vérapamil/diltiazem (bradycardie, bloc)');
select pg_temp.l('Hypertension artérielle', 'Général', 3, 'HTA résistante (après trithérapie optimale, observance et MAPA vérifiées)', 'Ajouter un ARM (spironolactone en 1er choix) ; surveiller kaliémie et créatinine. Puis bêta-bloquant, alpha-bloquant ou antihypertenseur central.');
select pg_temp.i('Hypertension artérielle', 'Général', 3, 'traitement', 'spironolactone', '4e médicament de référence (PATHWAY-2)');
select pg_temp.i('Hypertension artérielle', 'Général', 3, 'association', 'Bêta-bloquants', 'si spironolactone non tolérée');
select pg_temp.i('Hypertension artérielle', 'Général', 3, 'association', 'Alpha-bloquants', 'recours');
select pg_temp.i('Hypertension artérielle', 'Général', 3, 'association', 'Antihypertenseurs centraux', 'recours ultime');
select pg_temp.i('Hypertension artérielle', 'Général', 3, 'eviter', 'Antagonistes des récepteurs minéralocorticoïdes (ARM)', 'kaliémie ≥ 5 mmol/l ou DFG < 30 : prudence ; surveiller les associations IEC/ARA2 + ARM');

select pg_temp.l('Hypertension artérielle', 'Diabète / néphropathie albuminurique', 1, 'IEC ou ARA2 en priorité, associé à un inhibiteur calcique ou à un diurétique', 'Protection rénale en cas d’albuminurie ; surveiller créatinine et kaliémie.');
select pg_temp.i('Hypertension artérielle', 'Diabète / néphropathie albuminurique', 1, 'traitement', 'IEC');
select pg_temp.i('Hypertension artérielle', 'Diabète / néphropathie albuminurique', 1, 'traitement', 'ARA2');
select pg_temp.i('Hypertension artérielle', 'Diabète / néphropathie albuminurique', 1, 'association', 'Inhibiteurs calciques dihydropyridines');
select pg_temp.i('Hypertension artérielle', 'Diabète / néphropathie albuminurique', 1, 'association', 'Diurétiques thiazidiques et apparentés');
select pg_temp.l('Hypertension artérielle', 'Insuffisance rénale chronique', 1, 'IEC ou ARA2 + inhibiteur calcique ; diurétique de l’anse si DFG < 30', 'Les thiazidiques perdent leur efficacité sous DFG 30 : passer à un diurétique de l’anse. Éviter AINS ; contrôler kaliémie.');
select pg_temp.i('Hypertension artérielle', 'Insuffisance rénale chronique', 1, 'traitement', 'IEC');
select pg_temp.i('Hypertension artérielle', 'Insuffisance rénale chronique', 1, 'traitement', 'ARA2');
select pg_temp.i('Hypertension artérielle', 'Insuffisance rénale chronique', 1, 'association', 'Inhibiteurs calciques dihydropyridines');
select pg_temp.i('Hypertension artérielle', 'Insuffisance rénale chronique', 1, 'association', 'Diurétiques de l’anse', 'si DFG < 30 ou œdèmes');
select pg_temp.l('Hypertension artérielle', 'Sujet âgé (≥ 80 ans ou fragile)', 1, 'Monothérapie à faible dose progressive puis bithérapie prudente', 'Cible < 140–150 mmHg, en évitant l’hypotension orthostatique. Inhibiteur calcique ou thiazidique (indapamide) bien validés.');
select pg_temp.i('Hypertension artérielle', 'Sujet âgé (≥ 80 ans ou fragile)', 1, 'traitement', 'Inhibiteurs calciques dihydropyridines');
select pg_temp.i('Hypertension artérielle', 'Sujet âgé (≥ 80 ans ou fragile)', 1, 'traitement', 'indapamide', 'étude HYVET');
select pg_temp.i('Hypertension artérielle', 'Sujet âgé (≥ 80 ans ou fragile)', 1, 'association', 'IEC');
select pg_temp.l('Hypertension artérielle', 'Patient d’origine africaine', 1, 'Inhibiteur calcique + diurétique thiazidique d’emblée', 'IEC/ARA2 moins efficaces en monothérapie dans cette population ; les associer aux autres classes si indication (diabète, rein).');
select pg_temp.i('Hypertension artérielle', 'Patient d’origine africaine', 1, 'traitement', 'Inhibiteurs calciques dihydropyridines');
select pg_temp.i('Hypertension artérielle', 'Patient d’origine africaine', 1, 'traitement', 'Diurétiques thiazidiques et apparentés');
select pg_temp.l('Hypertension artérielle', 'Coronarien / post-infarctus', 1, 'Bêta-bloquant + IEC ou ARA2', 'Ajouter un inhibiteur calcique DHP si besoin. Bêta-bloquant surtout dans les 1 à 3 ans après infarctus.');
select pg_temp.i('Hypertension artérielle', 'Coronarien / post-infarctus', 1, 'traitement', 'Bêta-bloquants');
select pg_temp.i('Hypertension artérielle', 'Coronarien / post-infarctus', 1, 'traitement', 'IEC');
select pg_temp.i('Hypertension artérielle', 'Coronarien / post-infarctus', 1, 'association', 'Inhibiteurs calciques dihydropyridines');
select pg_temp.l('Hypertension artérielle', 'Grossesse / projet de grossesse', 1, 'Labétalol, nifédipine LP ou méthyldopa', 'IEC, ARA2 et ARNI contre-indiqués : relais avant la conception ou dès le test positif.');
select pg_temp.i('Hypertension artérielle', 'Grossesse / projet de grossesse', 1, 'traitement', 'labétalol');
select pg_temp.i('Hypertension artérielle', 'Grossesse / projet de grossesse', 1, 'traitement', 'nifédipine');
select pg_temp.i('Hypertension artérielle', 'Grossesse / projet de grossesse', 1, 'traitement', 'méthyldopa');
select pg_temp.i('Hypertension artérielle', 'Grossesse / projet de grossesse', 1, 'eviter', 'IEC', 'foetotoxique (2e et 3e trimestres) ; tératogène possible au 1er');
select pg_temp.i('Hypertension artérielle', 'Grossesse / projet de grossesse', 1, 'eviter', 'ARA2', 'foetotoxique (2e et 3e trimestres)');

-- ============================ PROTOCOLES : DIABÈTE DE TYPE 2 ============================
select pg_temp.l('Diabète de type 2', 'Général', 1, 'Mesures hygiéno-diététiques + metformine d’emblée', 'Titration progressive, au cours des repas. Contrôle de l’HbA1c à 3 mois.');
select pg_temp.i('Diabète de type 2', 'Général', 1, 'traitement', 'metformine', 'contre-indiquée si DFG < 30 ; dose max 1 g/j si DFG 30–45');
select pg_temp.l('Diabète de type 2', 'Général', 2, 'Bithérapie : ajouter une 2e classe selon le profil du patient', 'Sans comorbidité cardio-rénale ni obésité : gliptine (à défaut sulfamide). Avec comorbidité : voir profils.');
select pg_temp.i('Diabète de type 2', 'Général', 2, 'traitement', 'Inhibiteurs de la DPP-4 (gliptines)', 'peu d’hypoglycémies, neutres sur le poids');
select pg_temp.i('Diabète de type 2', 'Général', 2, 'traitement', 'Inhibiteurs du SGLT2 (gliflozines)', 'bénéfice cardio-rénal');
select pg_temp.i('Diabète de type 2', 'Général', 2, 'traitement', 'Agonistes du récepteur du GLP-1', 'bénéfice cardiovasculaire et poids');
select pg_temp.i('Diabète de type 2', 'Général', 2, 'association', 'Sulfamides hypoglycémiants', 'si autres classes impossibles ; risque d’hypoglycémie et de prise de poids');
select pg_temp.i('Diabète de type 2', 'Général', 2, 'eviter', 'Glinides', 'ne jamais associer un glinide à un sulfamide');
select pg_temp.i('Diabète de type 2', 'Général', 2, 'eviter', 'Agonistes du récepteur du GLP-1', 'ne pas associer un agoniste du GLP-1 à une gliptine');
select pg_temp.l('Diabète de type 2', 'Général', 3, 'Trithérapie si HbA1c toujours au-dessus de l’objectif', 'Ajouter une 3e classe de mécanisme différent (gliflozine, agoniste du GLP-1, gliptine, sulfamide) ou passer à une association fixe.');
select pg_temp.i('Diabète de type 2', 'Général', 3, 'traitement', 'Associations fixes antidiabétiques');
select pg_temp.i('Diabète de type 2', 'Général', 3, 'association', 'Glitazones', 'recours ; rétention hydrique, IC = contre-indication');
select pg_temp.l('Diabète de type 2', 'Général', 4, 'Insulinothérapie basale (± agoniste du GLP-1) si HbA1c très élevée, symptômes ou échec', 'Insuline basale le soir ou le matin avec metformine ; préférer l’association à un GLP-1 avant les insulines prandiales ; éducation hypoglycémie et auto-surveillance.');
select pg_temp.i('Diabète de type 2', 'Général', 4, 'traitement', 'Insulines basales');
select pg_temp.i('Diabète de type 2', 'Général', 4, 'association', 'Agonistes du récepteur du GLP-1', 'association préférée à l’ajout d’insuline prandiale');
select pg_temp.i('Diabète de type 2', 'Général', 4, 'association', 'Insulines prandiales', 'si besoin de couvrir les repas');

select pg_temp.l('Diabète de type 2', 'Maladie cardiovasculaire athéroscléreuse', 2, 'Agoniste du GLP-1 (bénéfice CV démontré) ou gliflozine, indépendamment de l’HbA1c', 'En complément de la metformine. Choisir une molécule à bénéfice démontré : liraglutide, dulaglutide, sémaglutide ; empagliflozine.');
select pg_temp.i('Diabète de type 2', 'Maladie cardiovasculaire athéroscléreuse', 2, 'traitement', 'sémaglutide');
select pg_temp.i('Diabète de type 2', 'Maladie cardiovasculaire athéroscléreuse', 2, 'traitement', 'liraglutide');
select pg_temp.i('Diabète de type 2', 'Maladie cardiovasculaire athéroscléreuse', 2, 'traitement', 'dulaglutide');
select pg_temp.i('Diabète de type 2', 'Maladie cardiovasculaire athéroscléreuse', 2, 'traitement', 'empagliflozine');
select pg_temp.l('Diabète de type 2', 'Insuffisance cardiaque', 2, 'Gliflozine (dapagliflozine ou empagliflozine) dès le diagnostic', 'Indiquée même sans diabète ; réduit hospitalisations et mortalité.');
select pg_temp.i('Diabète de type 2', 'Insuffisance cardiaque', 2, 'traitement', 'dapagliflozine');
select pg_temp.i('Diabète de type 2', 'Insuffisance cardiaque', 2, 'traitement', 'empagliflozine');
select pg_temp.i('Diabète de type 2', 'Insuffisance cardiaque', 2, 'eviter', 'Glitazones', 'rétention hydrique : contre-indiquées');
select pg_temp.i('Diabète de type 2', 'Insuffisance cardiaque', 2, 'eviter', 'saxagliptine', 'sur-risque d’hospitalisation pour IC');
select pg_temp.l('Diabète de type 2', 'Maladie rénale chronique (DFG 20–60 ou albuminurie)', 2, 'Gliflozine pour la protection rénale ; agoniste du GLP-1 en alternative', 'Adapter la metformine au DFG (arrêt si < 30). Linagliptine sans adaptation de dose.');
select pg_temp.i('Diabète de type 2', 'Maladie rénale chronique (DFG 20–60 ou albuminurie)', 2, 'traitement', 'Inhibiteurs du SGLT2 (gliflozines)');
select pg_temp.i('Diabète de type 2', 'Maladie rénale chronique (DFG 20–60 ou albuminurie)', 2, 'association', 'Agonistes du récepteur du GLP-1');
select pg_temp.i('Diabète de type 2', 'Maladie rénale chronique (DFG 20–60 ou albuminurie)', 2, 'association', 'linagliptine');
select pg_temp.i('Diabète de type 2', 'Maladie rénale chronique (DFG 20–60 ou albuminurie)', 2, 'eviter', 'metformine', 'contre-indiquée si DFG < 30');
select pg_temp.l('Diabète de type 2', 'Obésité (IMC ≥ 30)', 2, 'Agoniste du GLP-1 (ou double agoniste GIP/GLP-1)', 'Perte de poids additionnelle ; titration lente pour limiter les effets digestifs.');
select pg_temp.i('Diabète de type 2', 'Obésité (IMC ≥ 30)', 2, 'traitement', 'sémaglutide');
select pg_temp.i('Diabète de type 2', 'Obésité (IMC ≥ 30)', 2, 'traitement', 'tirzépatide');
select pg_temp.i('Diabète de type 2', 'Obésité (IMC ≥ 30)', 2, 'traitement', 'liraglutide');
select pg_temp.l('Diabète de type 2', 'Sujet âgé fragile', 1, 'Cible d’HbA1c 7–8 % ; éviter l’hypoglycémie', 'Metformine si bien tolérée ; gliptine en 2e ligne ; éviter sulfamides et glinides ; adapter à la fonction rénale.');
select pg_temp.i('Diabète de type 2', 'Sujet âgé fragile', 1, 'traitement', 'Inhibiteurs de la DPP-4 (gliptines)');
select pg_temp.i('Diabète de type 2', 'Sujet âgé fragile', 1, 'eviter', 'Sulfamides hypoglycémiants', 'hypoglycémies, chutes');
select pg_temp.i('Diabète de type 2', 'Sujet âgé fragile', 1, 'eviter', 'glibenclamide', 'hypoglycémies prolongées');

-- ============================ PROTOCOLES : DYSLIPIDÉMIES ============================
select pg_temp.l('Dyslipidémies (hypercholestérolémie)', 'Général', 1, 'Statine de forte intensité à la dose maximale tolérée + mesures hygiéno-diététiques', 'Atorvastatine 40–80 mg ou rosuvastatine 20–40 mg. Contrôle lipidique à 4–6 semaines.');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Général', 1, 'traitement', 'atorvastatine');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Général', 1, 'traitement', 'rosuvastatine');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Général', 1, 'eviter', 'gemfibrozil', 'association contre-indiquée avec les statines');
select pg_temp.l('Dyslipidémies (hypercholestérolémie)', 'Général', 2, 'Ajouter l’ézétimibe si l’objectif de LDL-cholestérol n’est pas atteint à 4–6 semaines', 'Association libre ou fixe (ézétimibe/simvastatine).');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Général', 2, 'association', 'ézétimibe');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Général', 2, 'association', 'ézétimibe/simvastatine');
select pg_temp.l('Dyslipidémies (hypercholestérolémie)', 'Général', 3, 'Ajouter un anti-PCSK9 si risque très élevé ou hypercholestérolémie familiale toujours au-dessus de l’objectif', 'Sous statine maximale tolérée + ézétimibe. Conditions de prise en charge à vérifier.');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Général', 3, 'traitement', 'alirocumab');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Général', 3, 'traitement', 'évolocumab');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Général', 3, 'association', 'inclisiran', 'alternative en administration semestrielle');
select pg_temp.l('Dyslipidémies (hypercholestérolémie)', 'Intolérance aux statines', 1, 'Changer de statine ou réduire la dose (rosuvastatine, pravastatine), 3 jours/semaine si besoin', 'Vérifier les interactions et la TSH, la vitamine D ; écarter un effet nocebo.');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Intolérance aux statines', 1, 'traitement', 'rosuvastatine');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Intolérance aux statines', 1, 'traitement', 'pravastatine');
select pg_temp.l('Dyslipidémies (hypercholestérolémie)', 'Intolérance aux statines', 2, 'Ézétimibe seul, puis acide bempédoïque, puis anti-PCSK9', 'Escalade selon l’objectif de LDL-cholestérol.');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Intolérance aux statines', 2, 'traitement', 'ézétimibe');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Intolérance aux statines', 2, 'association', 'Acide bempédoïque');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Intolérance aux statines', 2, 'association', 'Inhibiteurs de PCSK9');
select pg_temp.l('Dyslipidémies (hypercholestérolémie)', 'Hypertriglycéridémie (TG > 2 g/l)', 1, 'Mesures hygiéno-diététiques (alcool, sucres, perte de poids) + statine selon le risque global', 'Corriger la cause secondaire : diabète déséquilibré, hypothyroïdie, alcool, médicaments.');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Hypertriglycéridémie (TG > 2 g/l)', 1, 'traitement', 'Statines');
select pg_temp.l('Dyslipidémies (hypercholestérolémie)', 'Hypertriglycéridémie (TG > 2 g/l)', 2, 'Fénofibrate si TG toujours > 2 g/l sous statine ou TG > 5 g/l', 'Préférer le fénofibrate au gemfibrozil en association à une statine ; surveiller les CPK et la fonction rénale.');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Hypertriglycéridémie (TG > 2 g/l)', 2, 'traitement', 'fénofibrate');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Hypertriglycéridémie (TG > 2 g/l)', 2, 'eviter', 'gemfibrozil', 'rhabdomyolyse avec les statines');
select pg_temp.l('Dyslipidémies (hypercholestérolémie)', 'Hypercholestérolémie familiale', 1, 'Statine forte + ézétimibe d’emblée, puis anti-PCSK9 si besoin', 'Objectif LDL-cholestérol ≤ 0,70 g/l (≤ 0,55 g/l si risque très élevé). Dépistage familial.');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Hypercholestérolémie familiale', 1, 'traitement', 'atorvastatine');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Hypercholestérolémie familiale', 1, 'traitement', 'rosuvastatine');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Hypercholestérolémie familiale', 1, 'association', 'ézétimibe');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Hypercholestérolémie familiale', 1, 'association', 'Inhibiteurs de PCSK9');
select pg_temp.l('Dyslipidémies (hypercholestérolémie)', 'Prévention primaire (risque faible à modéré)', 1, 'Mesures hygiéno-diététiques ; statine d’intensité modérée si l’objectif n’est pas atteint', 'Objectif selon le risque (LDL < 1,16 g/l en risque faible, < 1,00 g/l en risque modéré).');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Prévention primaire (risque faible à modéré)', 1, 'traitement', 'pravastatine');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Prévention primaire (risque faible à modéré)', 1, 'traitement', 'atorvastatine');
select pg_temp.l('Dyslipidémies (hypercholestérolémie)', 'Diabète', 1, 'Statine d’intensité adaptée au risque (risque élevé ou très élevé selon l’âge, l’ancienneté et les atteintes d’organe)', 'Objectif LDL-cholestérol < 0,70 g/l (risque élevé) ou < 0,55 g/l (risque très élevé).');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Diabète', 1, 'traitement', 'atorvastatine');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Diabète', 1, 'traitement', 'rosuvastatine');
select pg_temp.i('Dyslipidémies (hypercholestérolémie)', 'Diabète', 1, 'association', 'ézétimibe');

-- ============================ PROTOCOLES : IC À FEVG RÉDUITE ============================
select pg_temp.l('Insuffisance cardiaque à FEVG réduite', 'Général', 1, 'Quadrithérapie : ARNI (ou IEC/ARA2) + bêta-bloquant + ARM + gliflozine', 'Introduire les 4 classes rapidement, à faible dose, puis titrer toutes les 2 semaines. Contrôler tension, kaliémie et créatinine.');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Général', 1, 'traitement', 'ARNI', 'de préférence ; sinon IEC ou ARA2');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Général', 1, 'traitement', 'Bêta-bloquants', 'bisoprolol, carvédilol, nébivolol, métoprolol succinate');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Général', 1, 'traitement', 'Antagonistes des récepteurs minéralocorticoïdes (ARM)', 'spironolactone ou éplérénone');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Général', 1, 'traitement', 'Inhibiteurs du SGLT2 (gliflozines)', 'dapagliflozine ou empagliflozine');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Général', 1, 'association', 'IEC', 'si ARNI non toléré ou indisponible');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Général', 1, 'eviter', 'IEC', 'jamais avec l’ARNI : attendre 36 h après l’arrêt de l’IEC (angiœdème)');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Général', 1, 'eviter', 'Inhibiteurs calciques non dihydropyridines', 'inotropes négatifs : contre-indiqués');
select pg_temp.l('Insuffisance cardiaque à FEVG réduite', 'Général', 2, 'Diurétique de l’anse selon la congestion', 'Dose minimale efficace, pesée quotidienne (prise de poids > 2 kg en 3 jours : consulter). Éviter AINS.');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Général', 2, 'traitement', 'Diurétiques de l’anse');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Général', 2, 'eviter', 'Antagonistes des récepteurs minéralocorticoïdes (ARM)', 'hyperkaliémie si associé à IEC/ARA2/ARNI sans surveillance');
select pg_temp.l('Insuffisance cardiaque à FEVG réduite', 'Général', 3, 'Symptômes persistants malgré le traitement optimal : ivabradine, vericiguat, digoxine', 'Ivabradine si rythme sinusal, FC ≥ 70/min sous bêta-bloquant maximal ; vericiguat après une aggravation récente ; digoxine si symptômes persistants ou fibrillation atriale.');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Général', 3, 'traitement', 'ivabradine');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Général', 3, 'traitement', 'vericiguat');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Général', 3, 'association', 'digoxine');
select pg_temp.l('Insuffisance cardiaque à FEVG réduite', 'Fibrillation atriale associée', 1, 'Anticoagulation selon CHA₂DS₂-VA ; contrôle de la fréquence par bêta-bloquant (± digoxine)', 'Éviter vérapamil et diltiazem (FEVG réduite) ; amiodarone possible pour le rythme.');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Fibrillation atriale associée', 1, 'traitement', 'Anticoagulants oraux directs (AOD)');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Fibrillation atriale associée', 1, 'traitement', 'Bêta-bloquants');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Fibrillation atriale associée', 1, 'association', 'digoxine');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Fibrillation atriale associée', 1, 'association', 'amiodarone');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Fibrillation atriale associée', 1, 'eviter', 'Inhibiteurs calciques non dihydropyridines');
select pg_temp.i('Insuffisance cardiaque à FEVG réduite', 'Fibrillation atriale associée', 1, 'eviter', 'flécaïnide', 'contre-indiqué en cardiopathie structurelle');

-- ============================ PROTOCOLES : FIBRILLATION ATRIALE ============================
select pg_temp.l('Fibrillation atriale', 'Général', 1, 'Prévention thromboembolique : anticoagulant oral direct si CHA₂DS₂-VA ≥ 2 (à discuter si = 1)', 'Choisir apixaban, rivaroxaban, dabigatran ou edoxaban selon l’âge, la fonction rénale et les comédications. Réévaluer le rapport bénéfice/risque hémorragique régulièrement (HAS-BLED).');
select pg_temp.i('Fibrillation atriale', 'Général', 1, 'traitement', 'Anticoagulants oraux directs (AOD)');
select pg_temp.i('Fibrillation atriale', 'Général', 1, 'eviter', 'Antivitamines K (AVK)', 'pas en 1re intention sauf valvulopathie mitrale ou prothèse mécanique');
select pg_temp.i('Fibrillation atriale', 'Général', 1, 'eviter', 'apixaban', 'ne pas associer à un AINS ou à un antiagrégant sans avis (saignement)');
select pg_temp.l('Fibrillation atriale', 'Général', 2, 'Contrôle de la fréquence cardiaque', 'Bêta-bloquant en 1er choix ; diltiazem ou vérapamil si FEVG > 40 % ; digoxine si inefficace ou sédentaire ; amiodarone en dernier recours.');
select pg_temp.i('Fibrillation atriale', 'Général', 2, 'traitement', 'Bêta-bloquants');
select pg_temp.i('Fibrillation atriale', 'Général', 2, 'association', 'Inhibiteurs calciques non dihydropyridines', 'si FEVG > 40 %');
select pg_temp.i('Fibrillation atriale', 'Général', 2, 'association', 'digoxine');
select pg_temp.l('Fibrillation atriale', 'Général', 3, 'Contrôle du rythme (symptômes persistants, cardioversion)', 'Flécaïnide ou propafénone si cœur structurellement sain ; amiodarone ou dronédarone en cas de cardiopathie ; sotalol avec surveillance du QT. Toujours sous contrôle spécialisé.');
select pg_temp.i('Fibrillation atriale', 'Général', 3, 'traitement', 'flécaïnide', 'cœur sain uniquement');
select pg_temp.i('Fibrillation atriale', 'Général', 3, 'traitement', 'amiodarone', 'cardiopathie ou insuffisance cardiaque');
select pg_temp.i('Fibrillation atriale', 'Général', 3, 'association', 'dronédarone', 'FA paroxystique/persistante sans insuffisance cardiaque sévère');
select pg_temp.i('Fibrillation atriale', 'Général', 3, 'association', 'sotalol');
select pg_temp.l('Fibrillation atriale', 'Valvulopathie mitrale modérée à sévère / prothèse valvulaire mécanique', 1, 'Antivitamine K (les AOD sont contre-indiqués)', 'INR cible selon le type de valve et le risque ; suivi en carnet AVK.');
select pg_temp.i('Fibrillation atriale', 'Valvulopathie mitrale modérée à sévère / prothèse valvulaire mécanique', 1, 'traitement', 'Antivitamines K (AVK)');
select pg_temp.i('Fibrillation atriale', 'Valvulopathie mitrale modérée à sévère / prothèse valvulaire mécanique', 1, 'eviter', 'Anticoagulants oraux directs (AOD)', 'contre-indiqués');
select pg_temp.l('Fibrillation atriale', 'Insuffisance rénale', 1, 'Apixaban ou edoxaban ajusté ; dabigatran contre-indiqué si DFG < 30', 'Contrôle de la fonction rénale au moins annuel (tous les 3–6 mois si DFG < 60). Aucun AOD recommandé si DFG < 15.');
select pg_temp.i('Fibrillation atriale', 'Insuffisance rénale', 1, 'traitement', 'apixaban', '2,5 mg × 2 si ≥ 2 critères (âge ≥ 80, poids ≤ 60 kg, créatinine ≥ 133 µmol/l)');
select pg_temp.i('Fibrillation atriale', 'Insuffisance rénale', 1, 'association', 'edoxaban', '30 mg/j si DFG 15–50');
select pg_temp.i('Fibrillation atriale', 'Insuffisance rénale', 1, 'eviter', 'dabigatran', 'contre-indiqué si DFG < 30');
select pg_temp.l('Fibrillation atriale', 'Sujet âgé / fragile', 1, 'Apixaban ou edoxaban ajusté à l’âge, au poids et à la fonction rénale', 'Risque de chute non une contre-indication ; surveiller anémie et fonction rénale.');
select pg_temp.i('Fibrillation atriale', 'Sujet âgé / fragile', 1, 'traitement', 'apixaban');
select pg_temp.i('Fibrillation atriale', 'Sujet âgé / fragile', 1, 'association', 'edoxaban');
select pg_temp.l('Fibrillation atriale', 'Coronaropathie récente (angioplastie / SCA)', 1, 'AOD + clopidogrel (double thérapie), aspirine limitée à la période péri-angioplastie', 'Durée courte de l’association (6–12 mois), puis AOD seul. Éviter le prasugrel et le ticagrélor en association à un AOD.');
select pg_temp.i('Fibrillation atriale', 'Coronaropathie récente (angioplastie / SCA)', 1, 'traitement', 'Anticoagulants oraux directs (AOD)');
select pg_temp.i('Fibrillation atriale', 'Coronaropathie récente (angioplastie / SCA)', 1, 'eviter', 'Antivitamines K (AVK)', 'sur-risque hémorragique avec les antiagrégants');

-- ============================ CARTES DE RÉVISION ============================
-- Cartes automatiques : classe, indication, spécialités ↔ DCI. Échéance
-- maintenant ; unique (molecule_id, question) → rejouable sans doublon.

insert into public.pharma_cartes (molecule_id, question, reponse)
select m.id, 'Classe de ' || m.dci || ' ?', c.nom
from public.pharma_ref_molecules m join public.pharma_ref_classes c on c.id = m.classe_id
on conflict do nothing;

insert into public.pharma_cartes (molecule_id, question, reponse)
select m.id, 'Indications de ' || m.dci || ' ?', array_to_string(m.indications, ' ; ')
from public.pharma_ref_molecules m
where cardinality(m.indications) > 0
on conflict do nothing;

insert into public.pharma_cartes (molecule_id, question, reponse)
select m.id, 'DCI et classe de ' || s.nom || ' ?', m.dci || ' (' || c.nom || ')'
from public.pharma_ref_specialites s
join public.pharma_ref_molecules m on m.id = s.molecule_id
join public.pharma_ref_classes c on c.id = m.classe_id
on conflict do nothing;

insert into public.pharma_cartes (molecule_id, question, reponse)
select m.id, 'Noms commerciaux de ' || m.dci || ' ?', string_agg(s.nom, ', ' order by s.nom)
from public.pharma_ref_molecules m join public.pharma_ref_specialites s on s.molecule_id = m.id
group by m.id, m.dci
on conflict do nothing;
