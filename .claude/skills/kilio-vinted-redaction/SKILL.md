---
name: kilio-vinted-redaction
description: "Rédiger dans le module Vinted de Kilio les brouillons d'annonces créés avec leurs photos : Claude lit les photos, propose titre, description, hashtags, catégorie, marque, taille, état, couleur, matière, prix et colis, puis écrit en base via Supabase. Utiliser quand l'utilisateur dit « rédige mes annonces Vinted », « remplis mes brouillons Vinted », « décris cet article pour Vinted », ou demande un texte plus soigné pour une annonce existante."
metadata:
  origin: kilio
---

# Rédaction d'annonces Vinted (Kilio)

Remplit les **brouillons** du module Vinted (`src/app/(app)/vinted/`) directement en base via le
serveur MCP Supabase (`mcp__Supabase__execute_sql`). L'utilisateur crée le brouillon et téléverse
les photos dans l'appli ; Claude rédige ; l'utilisateur relit, corrige et publie **lui-même** dans
l'appli Vinted avec le « kit de publication ». Ce skill ne publie jamais sur Vinted et n'écrit pas
dans le code du dépôt.

- **Projet Supabase** : `kilio` — `project_id = "vsmtkopkqasrdnjceegp"`. Si introuvable
  (`mcp__Supabase__list_projects`), demander avant de continuer.
- Échapper les apostrophes en les doublant (`l''état`).
- Tables : `vinted_annonces` (champs de l'annonce + `statut`), `vinted_photos` (`annonce_id`, `url`,
  `ordre`), `vinted_reglages` (une seule ligne : `signature`, `colis_defaut`, `hashtags_communs`,
  `hashtags_par_categorie`).

## Règles de fond

1. **N'inventer aucun fait.** Marque, taille, matière, mesures, défauts : ne les écrire que s'ils sont
   lisibles sur les photos (étiquette, couture) ou dictés par l'utilisateur. Sinon laisser le champ
   vide et le signaler dans la réponse. Un défaut visible (tache, bouloche, accroc) est mentionné
   honnêtement dans la description.
2. **Ne jamais écrire dans `statut`** sauf demande explicite. En fin de rédaction, dire s'il manque
   des champs pour passer l'annonce en « Prêt » (photos, titre, description, catégorie, état, prix,
   colis).
3. **Ne pas inclure la signature ni les hashtags dans `description`** : l'appli les ajoute
   (`description` + signature des réglages + hashtags). `hashtags` est un tableau de
   `#mots` en minuscules, sans accents ni espaces.
4. **Limites Vinted** : titre ≤ 100 caractères ; description finale (texte + signature + hashtags)
   ≤ 2000 caractères.
5. **Prix** : ne proposer un prix que comme suggestion argumentée (état, marque, prix neuf connu de
   l'utilisateur). Ne pas écraser un prix déjà saisi.
6. **Champs déjà remplis par l'utilisateur** : ne les modifier que s'il le demande ; sinon
   proposer la modification dans la réponse.
7. Texte seul, ton simple et factuel, en français, sans majuscules criardes ni promesses
   (« top qualité ») non vérifiables.

## Déroulé

### 1. Lire les brouillons à rédiger et les réglages

```sql
select a.id, a.titre, a.description, a.categorie, a.marque, a.taille, a.etat, a.couleur,
       a.matiere, a.prix, a.colis, a.statut,
       coalesce(array_agg(p.url order by p.ordre) filter (where p.id is not null), '{}') as photos
from vinted_annonces a
left join vinted_photos p on p.annonce_id = a.id
where a.statut = 'brouillon' and a.titre = ''
group by a.id
order by a.created_at;

select signature, colis_defaut, hashtags_communs, hashtags_par_categorie from vinted_reglages;
```

Si l'utilisateur cible une annonce précise ou un texte plus soigné, filtrer sur son `id` (ou son
titre) au lieu de `titre = ''`.

### 2. Regarder les photos

Ouvrir chaque URL de `photos` (outil de lecture d'images/fetch disponible). La première est la
couverture. Relever : type d'article, marque et taille sur l'étiquette, couleur, matière, état
visible, défauts.

### 3. Rédiger

- **Titre** : `Type + marque + détail clé + taille + couleur` (ex. « Robe midi Zara verte taille M »).
- **Description** : 3 à 6 lignes — ce que c'est, état réel (défauts compris), matière, coupe ou
  mesures si connues, point utile à l'acheteur. Pas de hashtags dedans.
- **Catégorie** : chemin Vinted en clair (ex. « Femmes › Vêtements › Robes › Robes midi »).
- **État** parmi : Neuf avec étiquette, Neuf sans étiquette, Très bon état, Bon état, Satisfaisant.
- **Hashtags** : 3 à 6 mots-clés pertinents (type, marque, style, saison), en plus de ceux que
  l'appli propose depuis les réglages.
- **Colis** : laisser vide pour utiliser `colis_defaut`, sauf article manifestement différent
  (Petit, Moyen, Grand).

### 4. Écrire

```sql
update vinted_annonces set
  titre = '...', description = '...', categorie = '...', marque = '...', taille = '...',
  etat = '...', couleur = '...', matiere = '...',
  hashtags = array['#robe', '#zara'],
  updated_at = now()
where id = '<uuid>';
```

N'écrire `prix` que s'il a été décidé avec l'utilisateur.

### 5. Rendre compte

Pour chaque annonce : titre proposé, ce qui a été déduit des photos, ce qui reste à compléter
(champs vides, prix à fixer). Rappeler que le texte est relisible et modifiable dans l'appli
(`/vinted/<id>`) avant de passer l'annonce en « Prêt ».
