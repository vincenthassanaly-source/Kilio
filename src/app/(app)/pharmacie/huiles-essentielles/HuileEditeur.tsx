"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { creerHuile, modifierHuile } from "@/app/actions/huiles";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/toast/toast-store";
import { useBackClose } from "@/hooks/useBackClose";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import { errorText, input, label, primaryButton } from "@/lib/ui";
import {
  indicationsUtilisees,
  PRECAUTIONS,
  proprietesUtilisees,
  VOIES,
  type HuileChamps,
  type PharmaHuile,
} from "@/lib/pharmacie/huiles";
import { TagsInput } from "./TagsInput";

function champsDe(huile?: PharmaHuile): HuileChamps {
  return {
    nom_fr: huile?.nom_fr ?? "",
    nom_latin: huile?.nom_latin ?? "",
    famille: huile?.famille ?? "",
    partie_distillee: huile?.partie_distillee ?? "",
    chemotype: huile?.chemotype ?? "",
    indications: huile?.indications ?? [],
    proprietes: huile?.proprietes ?? [],
    voies: huile?.voies ?? [],
    dermocaustique: huile?.dermocaustique ?? false,
    photosensibilisante: huile?.photosensibilisante ?? false,
    precautions: huile?.precautions ?? [],
    precautions_details: huile?.precautions_details ?? "",
    dosage: huile?.dosage ?? "",
    mode_emploi: huile?.mode_emploi ?? "",
    notes: huile?.notes ?? "",
    sources: huile?.sources ?? "",
  };
}

function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3 border-t border-line pt-3.5 first:border-t-0 first:pt-0">
      <legend className="mb-0.5 text-[13px] font-semibold uppercase tracking-wide text-ink-3">{titre}</legend>
      {children}
    </fieldset>
  );
}

function Case({ libelle, detail, cochee, onChange }: { libelle: string; detail?: string; cochee: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2 has-[:checked]:border-kcal/50 has-[:checked]:bg-kcal-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-kcal">
      <input
        type="checkbox"
        checked={cochee}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 accent-[var(--accent-kcal)]"
      />
      <span className="flex flex-col">
        <span className="text-[14.5px] font-medium text-ink">{libelle}</span>
        {detail && <span className="text-[12.5px] text-ink-2">{detail}</span>}
      </span>
    </label>
  );
}

function Champ({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={label}>{libelle}</span>
      {children}
    </label>
  );
}

function basculer(liste: string[], cle: string, actif: boolean): string[] {
  return actif ? [...liste.filter((c) => c !== cle), cle] : liste.filter((c) => c !== cle);
}

// Création (sans `huile`) et modification d'une fiche. `huiles` sert aux
// suggestions de tags. À l'enregistrement, l'action resynchronise aussi les
// cartes de révision de l'huile.
export function HuileEditeur({ huile, huiles, onClose }: { huile?: PharmaHuile; huiles: PharmaHuile[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [champs, setChamps] = useState<HuileChamps>(() => champsDe(huile));
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  useBackClose(true, onClose);

  function maj<K extends keyof HuileChamps>(cle: K, valeur: HuileChamps[K]) {
    setChamps((c) => ({ ...c, [cle]: valeur }));
  }

  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    startTransition(async () => {
      const resultat = await runAction(() => (huile ? modifierHuile(huile.id, champs) : creerHuile(champs)), {
        silencieux: true,
        onError: setErreur,
      });
      // Les cartes dépendent de la fiche : on rafraîchit aussi le cahier de révision.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.pharmacieHuiles }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pharmacie }),
      ]);
      if (!resultat.ok) return;
      showToast(huile ? "Fiche enregistrée" : "Huile ajoutée");
      onClose();
      const nouvelId = (resultat.data as { id: string } | undefined)?.id;
      if (!huile && nouvelId) router.push(`/pharmacie/huiles-essentielles/${nouvelId}`);
    });
  }

  return (
    <Modal title={huile ? `Modifier ${huile.nom_fr}` : "Nouvelle huile essentielle"} onClose={onClose}>
      <form onSubmit={enregistrer} className="flex flex-col gap-5">
        <Groupe titre="Identité">
          <Champ libelle="Nom français *">
            <input
              value={champs.nom_fr}
              onChange={(e) => maj("nom_fr", e.target.value)}
              className={input}
              required
              autoFocus={!huile}
              autoComplete="off"
              placeholder="Lavande vraie"
            />
          </Champ>
          <Champ libelle="Nom latin">
            <input
              value={champs.nom_latin}
              onChange={(e) => maj("nom_latin", e.target.value)}
              className={`${input} italic`}
              autoComplete="off"
              autoCapitalize="none"
              placeholder="Lavandula angustifolia"
            />
          </Champ>
          <Champ libelle="Famille botanique">
            <input value={champs.famille} onChange={(e) => maj("famille", e.target.value)} className={input} autoComplete="off" placeholder="Lamiacées" />
          </Champ>
          <Champ libelle="Partie distillée">
            <input
              value={champs.partie_distillee}
              onChange={(e) => maj("partie_distillee", e.target.value)}
              className={input}
              autoComplete="off"
              placeholder="Sommités fleuries"
            />
          </Champ>
          <Champ libelle="Chémotype">
            <input value={champs.chemotype} onChange={(e) => maj("chemotype", e.target.value)} className={input} autoComplete="off" placeholder="Linalol" />
          </Champ>
        </Groupe>

        <Groupe titre="Usage">
          <TagsInput
            libelle="Indications"
            aide="Entrée ou virgule pour ajouter."
            placeholder="stress, toux, sommeil…"
            valeur={champs.indications}
            onChange={(v) => maj("indications", v)}
            suggestions={indicationsUtilisees(huiles)}
          />
          <TagsInput
            libelle="Propriétés"
            placeholder="antiseptique, relaxante…"
            valeur={champs.proprietes}
            onChange={(v) => maj("proprietes", v)}
            suggestions={proprietesUtilisees(huiles)}
          />
        </Groupe>

        <Groupe titre="Voies d'utilisation">
          <div className="flex flex-col gap-2">
            {VOIES.map((voie) => (
              <Case
                key={voie.cle}
                libelle={voie.libelle}
                detail={voie.cle === "orale" ? "Cochée = l'huile est considérée comestible." : undefined}
                cochee={champs.voies.includes(voie.cle)}
                onChange={(v) => maj("voies", basculer(champs.voies, voie.cle, v))}
              />
            ))}
          </div>
        </Groupe>

        <Groupe titre="Sécurité">
          <div className="flex flex-col gap-2">
            <Case
              libelle="Dermocaustique"
              detail="Irritante : jamais pure sur la peau."
              cochee={champs.dermocaustique}
              onChange={(v) => maj("dermocaustique", v)}
            />
            <Case
              libelle="Photosensibilisante"
              detail="Pas de soleil après application."
              cochee={champs.photosensibilisante}
              onChange={(v) => maj("photosensibilisante", v)}
            />
          </div>
          <p className={label}>Déconseillée ou à éviter pour</p>
          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            {PRECAUTIONS.map((p) => (
              <Case
                key={p.cle}
                libelle={p.libelle}
                cochee={champs.precautions.includes(p.cle)}
                onChange={(v) => maj("precautions", basculer(champs.precautions, p.cle, v))}
              />
            ))}
          </div>
          <Champ libelle="Précisions sur les précautions">
            <textarea
              value={champs.precautions_details}
              onChange={(e) => maj("precautions_details", e.target.value)}
              rows={3}
              className={`${input} resize-y leading-[1.5]`}
              placeholder="Interactions, durée maximale, âge minimum…"
            />
          </Champ>
        </Groupe>

        <Groupe titre="Utilisation">
          <Champ libelle="Dosage et dilution">
            <textarea
              value={champs.dosage}
              onChange={(e) => maj("dosage", e.target.value)}
              rows={2}
              className={`${input} resize-y leading-[1.5]`}
              placeholder="2 gouttes dans 1 c. à c. d'huile végétale (≈ 5 %)"
            />
          </Champ>
          <Champ libelle="Mode d'emploi">
            <textarea value={champs.mode_emploi} onChange={(e) => maj("mode_emploi", e.target.value)} rows={3} className={`${input} resize-y leading-[1.5]`} />
          </Champ>
          <Champ libelle="Notes personnelles">
            <textarea value={champs.notes} onChange={(e) => maj("notes", e.target.value)} rows={3} className={`${input} resize-y leading-[1.5]`} />
          </Champ>
          <Champ libelle="Sources">
            <textarea
              value={champs.sources}
              onChange={(e) => maj("sources", e.target.value)}
              rows={2}
              className={`${input} resize-y leading-[1.5]`}
              placeholder="Livre, site, formation…"
            />
          </Champ>
        </Groupe>

        {erreur && (
          <p role="alert" className={errorText}>
            {erreur}
          </p>
        )}
        <button type="submit" disabled={enCours} className={`${primaryButton} min-h-11 self-end`}>
          {enCours ? "Enregistrement…" : huile ? "Enregistrer" : "Ajouter l'huile"}
        </button>
      </form>
    </Modal>
  );
}
