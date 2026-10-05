-- Nouveau mode de suivi d'objectif « nutrition » : la progression se calcule
-- toute seule depuis le Journal (jours sous la cible kcal, série, taux). Les
-- cibles restent dans objectifs_nutritionnels / nutrition_planning, rien à
-- migrer. Un seul objectif de ce type est autorisé : vérifié par la Server
-- Action (un index unique partiel ne peut pas citer la nouvelle valeur d'enum
-- dans la même transaction que son ajout).

alter type type_suivi_objectif add value if not exists 'nutrition';
