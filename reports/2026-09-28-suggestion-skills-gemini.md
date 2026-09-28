# Matching sémantique Gemini pour le mode « je ne sais pas quoi choisir »

Date : 2026-09-28

## Contexte

Le module Skills expose une modale « Aide-moi à choisir » (`SuggestionModal.tsx`) qui appelle la Server Action `suggererSkills(besoin)`. Jusqu'ici, cette fonction faisait un scoring naïf par mots communs entre le besoin décrit et le texte de chaque fiche (`nom` + `description` + `exemples`), marqué dans le code comme provisoire (« pas de matching sémantique en V1 »).

**Écart avec le brief à noter :** le brief indiquait un catalogue de 98 fiches / 9 catégories (dernière vérification). L'état réel en base (`skills_catalogue`, projet Supabase `vsmtkopkqasrdnjceegp`) est de **337 lignes / 13 catégories** — le catalogue a été étendu depuis (commit `da6ac43`, PR #9). Le dimensionnement ci-dessous (taille de prompt, coûts) est basé sur les 337 fiches réelles.

## Approche retenue

- **Fonctions pures extraites** dans un nouveau fichier `src/lib/skills/matching.ts` (pas de nouvelle dépendance npm, appel HTTP natif via `fetch`, cohérent avec le seul autre appel API externe du repo, `src/app/actions/carburants.ts`) :
  - `suggererSkillsParMotsCles(besoin, skills)` — l'ancienne logique de `suggererSkills`, renommée telle quelle et rendue pure (prend le catalogue en paramètre au lieu d'interroger Supabase elle-même).
  - `suggererSkillsParGemini(besoin, skills)` — nouvel appel à l'API Gemini (`gemini-2.5-flash-lite`, endpoint REST `generateContent`).
- `src/app/actions/skills.ts` : `suggererSkills` récupère le catalogue une seule fois, tente Gemini, et retombe sur le matching par mots-clés si Gemini renvoie `null` (échec). La signature exposée à l'UI (`Promise<Skill[]>`) est inchangée — aucune modification requise côté `SuggestionModal.tsx`/`SkillCard.tsx`.

### Requête envoyée à Gemini

Pour chaque appel, le catalogue complet est compacté en objets `{ id, nom, description, exemples, categorie }` (pas les colonnes `ordre`/`created_at`, inutiles au modèle) et injecté dans le prompt aux côtés du besoin décrit. Sortie forcée en JSON structuré via `responseMimeType: "application/json"` + `responseSchema` :

```json
{
  "type": "object",
  "properties": {
    "suggestions": { "type": "array", "items": { "type": "string" }, "maxItems": 3 }
  },
  "required": ["suggestions"]
}
```

`suggestions` contient les `id` (UUID) des 2-3 fiches les plus pertinentes, du plus au moins pertinent — un array d'identifiants plutôt qu'un parsing de texte libre, pour éviter toute fragilité de parsing. Les id renvoyés sont résolus vers les fiches complètes côté serveur (`Map` par id) ; un id halluciné par le modèle est silencieusement ignoré (filtré, pas d'erreur).

### Fallback

`suggererSkillsParGemini` renvoie `null` (déclenchant le repli automatique sur `suggererSkillsParMotsCles`) dans tous ces cas :
- `GEMINI_API_KEY` absente.
- Requête réseau en échec, ou plus lente que le timeout (`AbortSignal.timeout(6000)` — 6 s, court car on est sur Vercel Hobby).
- Réponse HTTP non-2xx.
- JSON structuré absent, malformé, ou champ `suggestions` non conforme au schéma attendu.

Un tableau vide `[]` renvoyé par Gemini est en revanche traité comme une réponse **valide** (le modèle n'a trouvé aucune fiche pertinente) — pas de repli dans ce cas, pour ne pas masquer un « aucune suggestion » légitime derrière le matching par mots-clés.

Le tout est enveloppé dans un seul `try/catch` : aucune exception ne remonte jamais à `suggererSkills`, qui elle-même ne peut échouer que si la lecture Supabase du catalogue échoue (comportement identique à avant).

## Vérifications effectuées

- `npm ci` (dépendances absentes dans ce sandbox) puis `npx next build` : build de production complet réussi (36 routes), TypeScript vérifié dans le cadre du build.
- `npx eslint` sur les 3 fichiers modifiés/créés : aucun avertissement.
- `npx vitest run` : 153 tests existants toujours au vert (aucune régression, le module Skills n'a pas de tests unitaires dédiés au préalable).

### Test manuel du gain sémantique

`GEMINI_API_KEY` n'est pas disponible dans ce sandbox d'exécution (elle est configurée côté Vercel uniquement, comme prévu par le brief) — impossible de faire un appel réel à Gemini ici. J'ai donc validé isolément la limite de l'ancien comportement (le matching par mots-clés, toujours en place comme filet de sécurité), en reproduisant sa logique exacte sur une fiche réelle du catalogue (`frontend-a11y` — « Patterns d'accessibilite React/Next.js... ») :

| Besoin décrit | Mots-clés (avant/fallback) |
|---|---|
| « Comment aider les malvoyants à naviguer sur mon site web » | **Aucune suggestion** — aucun mot du besoin ne recoupe le texte de la fiche (« malvoyants », « naviguer » ne matchent ni « accessibilite » ni « clavier », etc.) |
| « Je veux que les gens qui ont du mal à voir puissent quand même utiliser mon site correctement » | Une suggestion trouvée, mais **par accident** : ce sont les mots vides « que » et « ont » qui matchent (substrings de « semantique » et « frontend »), pas un vrai recoupement sémantique. |

C'est exactement le type de cas que le matching Gemini est censé corriger : reconnaître que « malvoyants » relève de l'accessibilité sans dépendre d'un recoupement lexical exact, et sans dépendre de collisions de sous-chaînes accidentelles avec des mots vides.

**Pour valider le comportement réel une fois en production/preview (où `GEMINI_API_KEY` est configurée) :**
1. Ouvrir `/skills`, cliquer « Aide-moi à choisir ».
2. Saisir « Comment aider les malvoyants à naviguer sur mon site web » (ou tout besoin dont le vocabulaire s'écarte du texte des fiches) et vérifier que `frontend-a11y` (ou une fiche d'accessibilité équivalente) apparaît.
3. Vérifier dans les logs Vercel (Runtime Logs) qu'aucune erreur silencieuse ne s'est produite, et que la réponse reste rapide (< ~2-3 s perçues, le timeout étant fixé à 6 s).
4. Pour tester le fallback explicitement : retirer temporairement `GEMINI_API_KEY` d'un environnement Preview et vérifier que la modale continue de fonctionner (résultats identiques à l'ancien comportement par mots-clés).

## Limites connues

- **Latence ajoutée** : chaque suggestion déclenche désormais un aller-retour réseau vers l'API Gemini (jusqu'à 6 s de timeout avant repli). C'était auparavant une simple requête Supabase quasi instantanée. Sur Vercel Hobby (limite de durée de Server Action), le timeout de 6 s a été choisi pour rester largement sous la limite, mais l'UX perçue sera plus lente qu'avant en cas d'appel Gemini réussi mais lent.
- **Quota gratuit** : `gemini-2.5-flash-lite` a un tier gratuit généreux mais non illimité (limites par minute et par jour côté Google AI Studio). Un usage personnel occasionnel (comme ici) ne devrait jamais l'atteindre, mais aucune alerte n'est en place si le quota était dépassé — le comportement observé serait simplement un repli silencieux et systématique sur le matching par mots-clés (HTTP 429 → `null` → fallback), sans erreur visible.
- **Taille du prompt** : les 337 fiches compactées (id, nom, description, exemples, categorie) sont envoyées en intégralité à chaque appel — pas de présélection ni de recherche vectorielle préalable. Largement dans les limites de contexte du modèle, mais chaque suggestion consomme donc un nombre de tokens d'entrée proportionnel à la taille totale du catalogue ; à mesure que le catalogue grossit encore, ça reste probablement négligeable pour ce volume, mais vaut la peine d'être gardé à l'œil si le catalogue passait à plusieurs milliers de fiches.
- **Erreurs du modèle** : Gemini peut se tromper de fiche, halluciner un id inexistant (silencieusement filtré, donc peut réduire le nombre de suggestions sous 2-3 sans que ce soit visible comme une erreur), ou juger à tort qu'aucune fiche n'est pertinente (retour `[]` traité comme valide, sans repli). Pas de mécanisme pour détecter ou signaler ces cas.
- **Pas de cache** : chaque besoin identique retapé redéclenche un appel Gemini complet (pas de mise en cache des résultats), ce qui est cohérent avec l'usage ponctuel de cette modale mais consomme du quota à chaque essai.

## Questions ouvertes

1. Le timeout de 6 s te semble-t-il correct, ou préfères-tu un délai plus court (repli plus rapide vers le mot-clé, UX plus prévisible) quitte à couper des réponses Gemini légitimement un peu lentes ?
2. Faut-il un signal visible côté UI quand le fallback mots-clés est utilisé (ex. petit badge « suggestion approximative »), ou le comportement doit-il rester totalement transparent comme implémenté actuellement ?
3. Le catalogue étant maintenant à 337 fiches (et en croissance), veux-tu qu'on prévoie dès maintenant une présélection (ex. par catégorie devinée, ou recherche lexicale grossière) avant l'appel Gemini pour réduire la taille du prompt, ou est-ce prématuré tant que la latence/le coût réels ne sont pas mesurés en usage ?
