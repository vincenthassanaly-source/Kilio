# Seed d'audit du faux Supabase

Données **fictives** réalistes (repas, tâches, notes, événements, habitudes, séances…) pour auditer l'app sans jamais toucher la base réelle. Aucune donnée réelle ici.

- Activation : `MOCK_SUPABASE_SEED=audit node e2e/mock-supabase.mjs`. Sans la variable, le faux Supabase garde ses fixtures d'origine (les tests e2e n'en dépendent pas).
- Un fichier par module : `e2e/seed-audit/<module>.mjs`, chargés par ordre alphabétique.
- Format :

```js
export default {
  // table: lignes ajoutées aux fixtures (une ligne dont l'id existe déjà est ignorée)
  habitudes: [{ id: "…", nom: "Lire 20 minutes", created_at: "__DAY(-30)__T08:00:00+00:00" }],
};
// Facultatif : embeds PostgREST (`alias:table(...)`) reconstitués à la lecture.
export const relations = {
  habitudes: { completions: (ligne, fixtures) => (fixtures.habitude_completions ?? []).filter((c) => c.habitude_id === ligne.id) },
};
```

- Jetons de date, résolus à la lecture (heure de Paris) : `"__TODAY__"` (valeur entière), `__DAY(n)__` (jour à n jours d'aujourd'hui, utilisable dans une chaîne), `__MONTH(n)__` (AAAA-MM).
- Avant d'ajouter des lignes à une table, vérifier qu'un autre fichier du dossier ou `e2e/mock-supabase.mjs` ne la remplit pas déjà ; utiliser des `id` distincts.
