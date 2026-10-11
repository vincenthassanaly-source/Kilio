-- Routines Musculation : 9 séances types (Push A/B/C, Pull A/B/C, Legs A/B/C)
-- construites uniquement à partir du catalogue d'exercices existant.
-- Séries cibles avec reps (ou durée en secondes pour les exercices en mode
-- « durée »), sans poids. Une routine déjà présente sous le même nom est
-- laissée telle quelle ; un exercice absent du catalogue fait échouer le script.

do $$
declare
  plan jsonb := $json$
  [
    {"nom": "Push A", "type": "PUSH", "exos": [
      ["Développé couché (barre)", 4, 8],
      ["Développé couché incliné (haltère)", 3, 10],
      ["Écarté (machine)", 3, 12],
      ["Développé militaire (haltère)", 3, 10],
      ["Extension triceps corde", 3, 12],
      ["Crunch", 3, 15]
    ]},
    {"nom": "Push B", "type": "PUSH", "exos": [
      ["Développé épaules (haltère)", 4, 8],
      ["Élévation latérale (haltère)", 4, 12],
      ["Élévation frontale (haltère)", 3, 12],
      ["Chest press (machine)", 3, 10],
      ["Extension triceps poulie haute", 3, 12],
      ["Dips sur banc", 3, 12],
      ["Planche", 3, 45]
    ]},
    {"nom": "Push C", "type": "PUSH", "exos": [
      ["Développé couché (haltère)", 3, 10],
      ["Développé Arnold (haltère)", 3, 10],
      ["Butterfly (pec deck)", 3, 12],
      ["Élévation latérale (haltère)", 3, 15],
      ["Extension triceps (machine)", 3, 12],
      ["Dips triceps au sol", 3, 12],
      ["Relevé de genoux allongé", 3, 15]
    ]},
    {"nom": "Pull A", "type": "PULL", "exos": [
      ["Tractions", 4, 8],
      ["Tirage poitrine (poulie)", 3, 10],
      ["Rowing poulie assis", 3, 10],
      ["Tirage vers le visage", 3, 15],
      ["Curl biceps (barre)", 3, 10],
      ["Extension dos (hyperextension lestée)", 3, 12]
    ]},
    {"nom": "Pull B", "type": "PULL", "exos": [
      ["Rowing penché (haltère)", 4, 8],
      ["Rowing assis (machine)", 3, 10],
      ["Tirage poitrine prise serrée (poulie)", 3, 10],
      ["Oiseau penché (haltère)", 3, 15],
      ["Curl marteau (haltère)", 3, 10],
      ["Shrug (haltère)", 3, 12],
      ["Dead bug", 3, 10]
    ]},
    {"nom": "Pull C", "type": "PULL", "exos": [
      ["Tractions supination", 3, 8],
      ["Seal row (haltère)", 3, 10],
      ["Rowing poulie assis prise en V", 3, 12],
      ["Curl biceps (haltère)", 3, 12],
      ["Curl marteau (poulie)", 3, 12],
      ["Curl poignets inversé (haltère)", 3, 15],
      ["Superman", 3, 12]
    ]},
    {"nom": "Legs A", "type": "LEGS", "exos": [
      ["Squat (barre)", 4, 8],
      ["Presse à cuisses horizontale", 3, 10],
      ["Leg curl assis (machine)", 3, 12],
      ["Presse mollets (machine)", 4, 15],
      ["Planche", 3, 45],
      ["Crunch", 3, 15]
    ]},
    {"nom": "Legs B", "type": "LEGS", "exos": [
      ["Presse à cuisses horizontale", 4, 10],
      ["Relevé de bassin (barre)", 4, 10],
      ["Extension jambes (machine)", 3, 12],
      ["Leg curl assis (machine)", 3, 12],
      ["Adduction hanche (machine)", 3, 15],
      ["Relevé de jambe barres parallèles", 3, 10]
    ]},
    {"nom": "Legs C", "type": "LEGS", "exos": [
      ["Extension jambes (machine)", 3, 15],
      ["Squat (barre)", 3, 12],
      ["Relevé de bassin (barre)", 3, 12],
      ["Leg curl assis (machine)", 3, 15],
      ["Presse mollets (machine)", 3, 20],
      ["Adduction hanche (machine)", 3, 15],
      ["Extension dos (hyperextension lestée)", 3, 12]
    ]}
  ]
  $json$;
  r jsonb;
  e jsonb;
  v_routine uuid;
  v_exercice public.exercices%rowtype;
  v_re uuid;
  v_ordre_routine integer;
  v_ordre integer;
  i integer;
begin
  select coalesce(max(ordre) + 1, 0) into v_ordre_routine from public.routines;

  for r in select * from jsonb_array_elements(plan) loop
    if exists (select 1 from public.routines where lower(btrim(nom)) = lower(r->>'nom')) then
      continue;
    end if;

    insert into public.routines (nom, type_seance, ordre)
    values (r->>'nom', r->>'type', v_ordre_routine)
    returning id into v_routine;
    v_ordre_routine := v_ordre_routine + 1;

    v_ordre := 0;
    for e in select * from jsonb_array_elements(r->'exos') loop
      select * into v_exercice from public.exercices
      where lower(btrim(nom)) = lower(e->>0);
      if not found then
        raise exception 'Exercice introuvable au catalogue : %', e->>0;
      end if;

      insert into public.routine_exercices (routine_id, exercice_id, ordre)
      values (v_routine, v_exercice.id, v_ordre)
      returning id into v_re;
      v_ordre := v_ordre + 1;

      for i in 0 .. (e->>1)::integer - 1 loop
        insert into public.routine_series (routine_exercice_id, ordre, type_serie, reps, duree_s)
        values (
          v_re, i, 'normale',
          case when v_exercice.mode_saisie = 'duree' then null else (e->>2)::integer end,
          case when v_exercice.mode_saisie = 'duree' then (e->>2)::integer else null end
        );
      end loop;
    end loop;
  end loop;
end $$;
