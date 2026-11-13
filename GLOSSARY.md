# Kilio

Application personnelle de Vincent : collection, documents, notes, agenda, tâches, musculation, opinions. Ce glossaire fixe le vocabulaire partagé entre le produit, le code et les discussions d'architecture.

## Language

**Suggestion**:
Ce que Gemini renvoie pour un élément (un titre, un rangement, une réorganisation, un résumé) avant que Vincent la valide. Elle est ensuite appliquée ou rejetée ; tant qu'elle n'est pas validée, rien n'est écrit en base.
_Avoid_: Proposition seule (ambiguë avec les propositions de partis dans Opinions), brouillon (réservé au scanner et à la musculation)

**Proposition (de parti)**:
Une mesure d'un programme de parti, lue puis marquée `lu` ou `favori` dans Opinions → Partis.
_Avoid_: Suggestion, mesure

## Vocabulaire des actions

Charte des libellés visibles (boutons, aria-labels, toasts, messages). Un verbe par geste, partout.

**Ajouter**:
Créer un élément. Boutons d'entrée « Ajouter un/une X » (sous-titre : une courte description) et bouton de validation d'un formulaire de création « Ajouter ». Le titre du formulaire reste « Nouveau/Nouvelle X ». « Créer » n'apparaît plus dans un libellé de création (« Créer le PDF » du Scanner génère un fichier : hors charte).
_Avoid_: Créer, Nouveau X (comme bouton d'entrée), « + X »

**Enregistrer**:
Valider la modification d'un élément existant (même bouton que « Ajouter » dans un formulaire commun à la création et à la modification : « Ajouter » en création, « Enregistrer » en modification).
_Avoid_: Valider, Sauvegarder

**Supprimer**:
Détruire un élément. Toujours écrit en entier, jamais « Suppr. ». Un seul patron : l'élément disparaît tout de suite, un toast « X supprimé · Annuler » reste 6 secondes, et l'appel serveur ne part qu'à la fin de ce délai (annuler ne fait aucun appel réseau ; quitter l'écran n'empêche pas la suppression, fermer l'app avant la fin la fait renoncer et l'élément réapparaît). Aucune boîte de confirmation pour supprimer : elles sont réservées aux pertes de brouillon (« Quitter sans enregistrer », « Vider le brouillon »).
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

**Carnet**:
Le suivi alimentaire de Nutrition (`/nutrition/journal`) : repas du jour, kcal et macros. Nom complet « Carnet alimentaire » (titre d'écran), forme courte « Carnet » (onglet de Nutrition, messages, réglages). Le rappel s'appelle « Rappel de saisie des repas ».
_Avoid_: Journal (réservé au module d'écriture), journal alimentaire

**Revue**:
L'écran « Revue de la semaine » (`/revue`) : le point hebdomadaire (tâches terminées, retards à replanifier, 7 prochains jours, santé de la semaine). Rappel : « Rappel de la revue hebdomadaire ».
_Avoid_: Bilan (pour désigner la Revue)

**Bilan**:
L'onglet Nutrition › Bilan : réussite des jours sur 7 et 30 jours. Deux mesures distinctes, nommées précisément : « sous la limite kcal » (kcal seuls, dans la synthèse de la semaine) et « cibles kcal et protéines atteintes » (kcal et protéines, dans le bilan par jour).
_Avoid_: « dans la limite », « dans les clous » (ambigus entre les deux mesures)

**Pesée**:
Le relevé du poids et du tour de taille, saisi depuis Aujourd'hui et affiché dans le Bilan.
_Avoid_: Relevé (sauf dans « pas de relevé »)

**À prendre / Pris**:
Les deux états d'un article de Courses : « à prendre » (pas encore dans le chariot) et « pris » (coché, rangé dans « Articles pris »). « Supprimer les articles pris » vide cette section.
_Avoid_: coché, archivé, actif (dans les textes visibles)

**Collection / élément**:
Une collection regroupe des éléments ; un élément est une photo ou un lien vidéo. Le nombre affiché sur une tuile est un nombre d'éléments.
_Avoid_: classeur, album ; « photos » pour désigner tout le contenu d'une collection

