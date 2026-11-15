# Kilio

Application personnelle de Vincent : collection, documents, notes, agenda, tâches, musculation, opinions. Ce glossaire fixe le vocabulaire partagé entre le produit, le code et les discussions d'architecture.

## Language

**Suggestion**:
Ce que Gemini renvoie pour un élément (un titre, un rangement, une réorganisation, un résumé) avant que Vincent la valide. Elle est ensuite appliquée ou rejetée ; tant qu'elle n'est pas validée, rien n'est écrit en base.
_Avoid_: Proposition seule (ambiguë avec les propositions de partis dans Opinions), brouillon (réservé au scanner et à la musculation)

**Proposition (de parti)**:
Une mesure d'un programme de parti, lue puis marquée `lu` ou `favori` dans Opinions → Partis.
_Avoid_: Suggestion, mesure

**Reprendre (une proposition)**:
Le geste « Reprendre dans mes idées » d'une proposition de parti : il crée un brouillon d'idée à partir d'elle, que Vincent complète puis valide. Ce n'est ni « Ajouter » ni « Suggestion » : la proposition d'origine reste telle quelle.
_Avoid_: « Copier », « Importer » (pour ce geste)

## Vocabulaire des actions

Charte des libellés visibles (boutons, aria-labels, toasts, messages). Un verbe par geste, partout.

**Ajouter**:
Créer un élément. Boutons d'entrée « Ajouter un/une X » (sous-titre : une courte description) et bouton de validation d'un formulaire de création « Ajouter ». Le titre du formulaire reste « Nouveau/Nouvelle X ». « Créer » n'apparaît plus dans un libellé de création (« Créer le PDF » du Scanner génère un fichier : hors charte).
_Avoid_: Créer, Nouveau X (comme bouton d'entrée), « + X »

**Enregistrer**:
Valider la modification d'un élément existant (même bouton que « Ajouter » dans un formulaire commun à la création et à la modification : « Ajouter » en création, « Enregistrer » en modification).
_Avoid_: Valider, Sauvegarder

**Modifier**:
Ouvrir un élément existant pour le changer : bouton d'entrée en modification (« Modifier la recette », « Modifier » sur une ligne d'ingrédient ou d'étape), puis « Enregistrer » pour valider. Un seul verbe pour ce geste, partout.
_Avoid_: Éditer, Renommer (pour ouvrir un formulaire qui change plus que le nom)

**Supprimer**:
Détruire un élément. Toujours écrit en entier, jamais « Suppr. ». Un seul patron : l'élément disparaît tout de suite, un toast « X supprimé · Annuler » reste 6 secondes, et l'appel serveur ne part qu'à la fin de ce délai (annuler ne fait aucun appel réseau ; quitter l'écran n'empêche pas la suppression, fermer l'app avant la fin la fait renoncer et l'élément réapparaît). Aucune boîte de confirmation pour supprimer : elles sont réservées aux pertes de brouillon (« Quitter sans enregistrer », « Vider le brouillon »). Exception : Courses supprime tout de suite côté serveur et restaure par réinsertion si on touche « Annuler » (patron d'origine de `supprimerAvecAnnulation`).
_Avoid_: Suppr., Effacer (réservé à « Effacer la feuille » du Journal, qui vide les traits sans supprimer la page), Vider

**Retirer**:
Détacher sans détruire : retirer un exercice d'une séance ou d'une routine, un repas d'un menu, un item d'une liste de saisie.
_Avoid_: Supprimer pour ces cas

**Annuler**:
Revenir en arrière sur une action qui vient d'être faite (toast « Annuler ») ou fermer un formulaire sans rien enregistrer.
_Avoid_: Fermer (réservé aux feuilles qui n'annulent rien, ex. la carte d'ajout d'articles de Courses)

**Journal**:
Le module d'écriture manuscrite (`/journal`, entrée du menu Plus) : une page par jour, écrite au stylet. « Feuille du soir » n'existe plus comme nom d'écran : c'est la page du jour du Journal. Le calendrier du Journal se nomme « Calendrier » ; le rappel du soir se nomme « Rappel du soir pour le Journal ».
_Avoid_: Feuille du soir, Relire, Vider ma tête, « journal » pour le suivi alimentaire

**Texte du jour**:
Le texte de la page du Journal d'un jour, séparé de la feuille manuscrite : on l'alimente en ajoutant une transcription (« Ajouter au texte du jour ») ou une note tapée au clavier. Il se relit et se corrige dans « Voir le texte » (les corrections sont enregistrées à la fermeture) et survit à « Effacer la feuille ». Dans le code, le Journal s'appelle encore « vidage » (noms de tables, de fichiers et d'actions).
_Avoid_: transcription (pour le texte déjà enregistré ; une transcription est la proposition de Gemini avant d'être ajoutée), « Valider » (pour l'ajouter)

**Carnet**:
Le suivi alimentaire de Nutrition (`/nutrition/journal`) : repas du jour, kcal et macros. Nom complet « Carnet alimentaire » (titre d'écran), forme courte « Carnet » (onglet de Nutrition, messages, réglages). Le rappel s'appelle « Rappel de saisie des repas ».
_Avoid_: Journal (réservé au module d'écriture), journal alimentaire

**Revue**:
L'écran « Revue de la semaine » (`/revue`) : le point hebdomadaire (tâches terminées, retards à replanifier, 7 prochains jours, santé de la semaine). Rappel : « Rappel de la revue hebdomadaire ».
_Avoid_: Bilan (pour désigner la Revue)

**En retard**:
Une tâche non faite dont l'échéance est passée. Un seul mot partout : l'onglet « En retard » de Tâches, la section « En retard » d'Aujourd'hui, « 2. Retards à replanifier » de la Revue.
_Avoid_: « Retard » seul pour l'onglet

**Tâche terminée / Tâche éphémère**:
« Terminée » est une tâche cochée ; elle est rangée dans « Tâches terminées » (Tâches et Agenda), où on peut la rouvrir. Une tâche **éphémère** (anciennement « Tâche du jour ») est supprimée automatiquement à la fin de la journée si elle n'est pas cochée ; la case du formulaire et la pastille de la carte la nomment ainsi.
_Avoid_: archivée (pour une tâche cochée), « Tâche du jour » (a trois sens dans l'app)

**Reporter / Replanifier**:
« Reporter » est le geste manuel : décaler l'échéance d'une ou plusieurs tâches à Aujourd'hui, Demain ou Lundi, avec « Annuler ». « Replanifier » est le geste de l'assistant IA de la Revue (« Replanifier les retards ») : il propose de nouvelles dates, que Vincent coche avant de les appliquer ensemble.
_Avoid_: « Reporter » pour l'IA, « Replanifier » pour le report manuel

**Assistant IA (Revue)**:
Le menu unique de la Revue (« Assistant IA ») qui regroupe quatre actions : analyser la semaine, résumer les 7 derniers jours, résumer les 7 prochains jours, replanifier les retards. Les résumés et l'analyse sont en lecture seule.
_Avoid_: « Bilan en mots » (le mot Bilan est réservé à Nutrition)

**Bilan**:
L'onglet Nutrition › Bilan : réussite des jours sur 7 et 30 jours. Deux mesures distinctes, nommées précisément : « sous la limite kcal » (kcal seuls, dans la synthèse de la semaine) et « cibles kcal et protéines atteintes » (kcal et protéines, dans le bilan par jour).
_Avoid_: « dans la limite », « dans les clous » (ambigus entre les deux mesures)

**Pesée**:
Le relevé du poids et du tour de taille, saisi depuis Aujourd'hui et affiché dans le Bilan.
_Avoid_: Relevé (sauf dans « pas de relevé »)

**À prendre / Pris**:
Les deux états d'un article de Courses : « à prendre » (pas encore dans le chariot) et « pris » (coché, rangé dans « Articles pris »). « Supprimer les articles pris » vide cette section.
_Avoid_: coché, archivé, actif (dans les textes visibles)

**Vrac**:
L'état des documents pas encore rangés (`en_vrac`), avec son onglet « Vrac » dans Documents. Les documents partagés depuis Android ou envoyés par « Enregistrer dans Documents » du Scanner y arrivent. Ce n'est pas un dossier : on en sort en choisissant une catégorie, et « Remettre en vrac » les y replace.
_Avoid_: dossier, boîte de réception

**Catégorie (de document)**:
Le rangement d'un document, gérable depuis l'icône « Gérer les catégories » de Documents. Dans le formulaire d'un document, « Sans catégorie » est le choix vide.
_Avoid_: dossier, étiquette (les deux ont été retirés)

**Trier / Ordre**:
« Trier » classe le vrac avec l'IA : le résultat est une Suggestion, appliquée ou rejetée par Vincent. « Ordre » est le sélecteur d'ordre d'affichage de la liste des documents (récent, nom A→Z, catégorie A→Z).
_Avoid_: « Trier » pour le sélecteur d'ordre

**Réorganiser**:
La refonte proposée par l'IA des catégories de Documents ou des collections de Collection : un aperçu, puis « Appliquer ». Rien n'est écrit avant.

**Collection / élément**:
Une collection regroupe des éléments ; un élément est une photo ou un lien vidéo. Le nombre affiché sur une tuile est un nombre d'éléments.
_Avoid_: classeur, album ; « photos » pour désigner tout le contenu d'une collection

