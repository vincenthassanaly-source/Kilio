-- Routines Legs A/B/C : recomposées avec les nouveaux exercices de jambes du
-- catalogue (split squat bulgare, fentes, soulevé de terre roumain, squat
-- Smith, goblet squat, relevé de bassin haltère).
-- Les routines gardent leur identifiant (l'historique des entraînements y reste
-- rattaché) ; seuls leurs exercices et séries sont remplacés. Un exercice
-- absent du catalogue fait échouer le script.

do $$
declare
  plan jsonb := $json$
  [
    {"nom": "Legs A", "exos": [
      ["Squat (barre)", 4, 8],
      ["Presse à cuisses horizontale", 3, 10],
      ["Split squat bulgare (haltère)", 3, 10],
      ["Leg curl assis (machine)", 3, 12],
      ["Presse mollets (machine)", 4, 15],
      ["Planche", 3, 45]
    ]},
    {"nom": "Legs B", "exos": [
      ["Soulevé de terre roumain (haltère)", 4, 8],
      ["Relevé de bassin (barre)", 4, 10],
      ["Fentes (haltère)", 3, 10],
      ["Leg curl assis (machine)", 3, 12],
      ["Adduction hanche (machine)", 3, 15],
      ["Relevé de jambe barres parallèles", 3, 10]
    ]},
    {"nom": "Legs C", "exos": [
      ["Squat (machine Smith)", 3, 12],
      ["Goblet squat", 3, 12],
      ["Extension jambes (machine)", 3, 15],
      ["Relevé de bassin (haltère)", 3, 12],
      ["Leg curl assis (machine)", 3, 15],
      ["Presse mollets (machine)", 3, 20],
      ["Extension dos (hyperextension lestée)", 3, 12]
    ]}
  ]
  $json$;
  r jsonb;
  e jsonb;
  v_routine uuid;
  v_exercice public.exercices%rowtype;
  v_re uuid;
  v_ordre integer;
  i integer;
begin
  for r in select * from jsonb_array_elements(plan) loop
    select id into v_routine from public.routines
    where type_seance = 'LEGS' and lower(btrim(nom)) = lower(r->>'nom');
    if not found then
      raise exception 'Routine introuvable : %', r->>'nom';
    end if;

    -- Les séries partent avec leur exercice (on delete cascade).
    delete from public.routine_exercices where routine_id = v_routine;

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

    update public.routines set updated_at = now() where id = v_routine;
  end loop;
end $$;
