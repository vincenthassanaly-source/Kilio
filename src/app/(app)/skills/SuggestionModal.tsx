"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Modal } from "@/components/Modal";
import { runAction } from "@/lib/actions/runAction";
import { suggererSkills, type Skill } from "@/app/actions/skills";
import { input, primaryButton, secondaryButton } from "@/lib/ui";
import { SkillCard } from "./SkillCard";

// Mode « je ne sais pas quoi choisir » : champ libre décrivant le besoin,
// matching sémantique côté serveur (suggererSkills, via Gemini avec repli
// par mots-clés — voir lib/skills/matching.ts).
export function SuggestionModal({ onClose }: { onClose: () => void }) {
  const [besoin, setBesoin] = useState("");
  const [suggestions, setSuggestions] = useState<Skill[] | null>(null);
  const [chargement, setChargement] = useState(false);

  async function suggerer() {
    if (besoin.trim().length < 3) return;
    setChargement(true);
    const resultat = await runAction(() => suggererSkills(besoin), {
      erreur: "La suggestion a échoué. Réessaie.",
    });
    setChargement(false);
    if (resultat.ok) setSuggestions(resultat.data);
  }

  return (
    <AnimatePresence>
      <Modal title="Je ne sais pas quoi choisir" onClose={onClose}>
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-[13.5px] text-ink-2">Décris ce que tu veux faire, en quelques mots.</p>
          <textarea
            value={besoin}
            onChange={(e) => setBesoin(e.target.value)}
            placeholder="Ex. : je veux nettoyer du code mort"
            rows={3}
            className={`${input} resize-none`}
            autoFocus
          />
          <div className="flex gap-2">
            <button type="button" onClick={suggerer} disabled={chargement || besoin.trim().length < 3} className={primaryButton}>
              {chargement ? "Recherche…" : "Suggérer"}
            </button>
            <button type="button" onClick={onClose} className={secondaryButton}>
              Fermer
            </button>
          </div>

          {suggestions && (
            <div className="flex flex-col gap-2.5 pt-1">
              {suggestions.length === 0 ? (
                <p className="text-[13.5px] text-ink-2">Aucune suggestion trouvée. Essaie avec d&apos;autres mots.</p>
              ) : (
                suggestions.map((skill) => <SkillCard key={skill.id} skill={skill} />)
              )}
            </div>
          )}
        </div>
      </Modal>
    </AnimatePresence>
  );
}
