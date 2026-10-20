"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  enregistrerApercu,
  enregistrerTranscription,
  getFeuille,
  supprimerTranscription,
  transcrireFeuille,
  type FeuilleVidage,
} from "@/app/actions/vidage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { Switch } from "@/components/Switch";
import { showErrorToast, showToast } from "@/components/toast/toast-store";
import { TransitionLink } from "@/components/TransitionLink";
import { runAction } from "@/lib/actions/runAction";
import { genererApercu, genererTranches } from "@/lib/vidage/apercu";
import {
  ajouter,
  annuler,
  gommer,
  historiqueVide,
  peutAnnuler,
  peutRetablir,
  retablir,
  type Historique,
} from "@/lib/vidage/historique";
import {
  EVENEMENT_FEUILLE_EN_ATTENTE,
  choisirFeuille,
  compterFeuillesEnAttente,
  ecrireFeuilleLocale,
  lireFeuilleLocale,
  memoriserFeuilleServeur,
  synchroniserFeuilles,
} from "@/lib/vidage/local";
import { HAUTEUR_MIN, hauteurRequise, type Epaisseur, type Trait } from "@/lib/vidage/traits";
import { eyebrow, ghostButton, linkButton, screenTitle } from "@/lib/ui";
import { BarreOutils } from "./BarreOutils";
import { FeuilleCanvas, type Outil } from "./FeuilleCanvas";
import { MenuFeuille } from "./MenuFeuille";
import { TranscriptionDialog } from "./TranscriptionDialog";

type Dialogue = "texte" | "effacer" | "supprimer-texte" | "retranscrire" | null;

type Props = {
  jour: string;
  aujourdhui: string;
  retour: { href: string; libelle: string };
};

const CLE_DOIGT = "kilio:vidage-doigt";
// Au-delà, on affiche la feuille locale (ou vide) sans attendre le serveur.
const DELAI_SERVEUR_MS = 4_000;
// Pause d'écriture avant de régénérer l'aperçu image du calendrier.
const DELAI_APERCU_MS = 8_000;

// Préférence « écrire aussi au doigt » : localStorage via useSyncExternalStore (jamais lue au
// rendu serveur), avec une copie en mémoire si le stockage est indisponible.
let doigtMemoire: boolean | null = null;
const ecouteursDoigt = new Set<() => void>();

function lireDoigt(): boolean {
  if (doigtMemoire !== null) return doigtMemoire;
  try {
    return localStorage.getItem(CLE_DOIGT) === "1";
  } catch {
    return false;
  }
}

function ecrireDoigt(valeur: boolean) {
  doigtMemoire = valeur;
  try {
    localStorage.setItem(CLE_DOIGT, valeur ? "1" : "0");
  } catch {
    // Préférence non mémorisée : valable jusqu'à la fermeture de l'application.
  }
  ecouteursDoigt.forEach((ecouteur) => ecouteur());
}

function abonnerDoigt(ecouteur: () => void) {
  ecouteursDoigt.add(ecouteur);
  return () => {
    ecouteursDoigt.delete(ecouteur);
  };
}

function libelleJour(jour: string): string {
  const texte = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${jour}T12:00:00Z`)
  );
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

async function chargerServeur(jour: string): Promise<FeuilleVidage | null> {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  try {
    const attente = new Promise<null>((resolve) => {
      minuteur = setTimeout(() => resolve(null), DELAI_SERVEUR_MS);
    });
    const resultat = await Promise.race([getFeuille(jour), attente]);
    return resultat?.ok ? resultat.data : null;
  } catch {
    // Hors ligne : la copie locale prend le relais.
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/** Envoie l'aperçu une fois la feuille reçue par le serveur (sinon il n'y aurait rien à relier). */
async function envoyerApercu(jour: string, traits: Trait[]): Promise<void> {
  if (traits.length === 0 || !navigator.onLine) return;
  try {
    const { restantes } = await synchroniserFeuilles();
    if (restantes > 0) return;
    const blob = await genererApercu(traits);
    if (!blob) return;
    const formData = new FormData();
    formData.set("apercu", new File([blob], `${jour}.png`, { type: "image/png" }));
    await enregistrerApercu(jour, formData);
  } catch {
    // L'aperçu n'est qu'une vignette : on réessaiera à la prochaine pause d'écriture.
  }
}

/**
 * Feuille du soir : écriture manuscrite, sauvegarde locale à chaque trait (la
 * synchronisation vers le serveur est faite par VidageSync). Des modifications
 * locales non envoyées priment toujours sur la version du serveur.
 */
export function FeuilleView({ jour, aujourdhui, retour }: Props) {
  const [pret, setPret] = useState(false);
  const [historique, setHistorique] = useState<Historique>(() => historiqueVide());
  const [outil, setOutil] = useState<Outil>("stylo");
  const [epaisseur, setEpaisseur] = useState<Epaisseur>(2);
  const [enAttente, setEnAttente] = useState(0);
  const [dialogue, setDialogue] = useState<Dialogue>(null);
  // Texte lu par Gemini pour la feuille telle qu'elle est ; effacé dès que les traits changent
  // (le serveur fait de même, voir enregistrerFeuille).
  const [transcription, setTranscription] = useState<string | null>(null);
  const [modifiee, setModifiee] = useState(false);
  const [enTranscription, setEnTranscription] = useState(false);

  const derniersEcrits = useRef<Trait[] | null>(null);
  const traitsCourants = useRef<Trait[]>([]);
  const minuteurApercu = useRef<number | undefined>(undefined);
  const apercuAFaire = useRef(false);

  const traits = historique.traits;
  const hauteur = useMemo(() => hauteurRequise(traits), [traits]);

  const ecritAuDoigt = useSyncExternalStore(abonnerDoigt, lireDoigt, () => false);

  // Chargement : la copie locale non envoyée prime ; sinon le serveur, avec repli local.
  useEffect(() => {
    let annule = false;
    (async () => {
      const local = await lireFeuilleLocale(jour);
      let serveur: FeuilleVidage | null = null;
      if (local?.a_envoyer !== 1) {
        serveur = await chargerServeur(jour);
        if (serveur) void memoriserFeuilleServeur(serveur);
      }
      if (annule) return;
      const choix = choisirFeuille(local, serveur, HAUTEUR_MIN);
      derniersEcrits.current = choix.traits;
      traitsCourants.current = choix.traits;
      setHistorique(historiqueVide(choix.traits));
      setTranscription(serveur?.transcription ?? null);
      setModifiee(serveur?.transcriptionModifiee ?? false);
      setPret(true);
      // À chaque ouverture : l'aperçu du calendrier se refait à partir des traits, donc
      // une vignette abîmée (ou d'une ancienne version) se répare en ouvrant la feuille.
      if (choix.traits.length > 0) void envoyerApercu(jour, choix.traits);
    })();
    return () => {
      annule = true;
    };
  }, [jour]);

  // Chaque modification est écrite sur le téléphone aussitôt ; VidageSync l'envoie après une pause.
  useEffect(() => {
    if (!pret || traits === derniersEcrits.current) return;
    derniersEcrits.current = traits;
    traitsCourants.current = traits;
    void ecrireFeuilleLocale(jour, traits, hauteur);
    apercuAFaire.current = true;
    window.clearTimeout(minuteurApercu.current);
    minuteurApercu.current = window.setTimeout(() => {
      apercuAFaire.current = false;
      void envoyerApercu(jour, traitsCourants.current);
    }, DELAI_APERCU_MS);
  }, [pret, traits, hauteur, jour]);

  // En quittant l'écran, l'aperçu en attente part tout de suite.
  useEffect(
    () => () => {
      window.clearTimeout(minuteurApercu.current);
      if (apercuAFaire.current) void envoyerApercu(jour, traitsCourants.current);
    },
    [jour]
  );

  // Indicateur d'envoi : relevé à chaque écriture, puis à intervalle régulier.
  useEffect(() => {
    let actif = true;
    const relever = () => void compterFeuillesEnAttente().then((n) => actif && setEnAttente(n));
    relever();
    const intervalle = window.setInterval(relever, 2_500);
    window.addEventListener(EVENEMENT_FEUILLE_EN_ATTENTE, relever);
    return () => {
      actif = false;
      window.clearInterval(intervalle);
      window.removeEventListener(EVENEMENT_FEUILLE_EN_ATTENTE, relever);
    };
  }, []);

  // Le texte transcrit décrit la feuille telle qu'elle était : toute modification l'oublie.
  const oublierTexte = useCallback(() => {
    setTranscription(null);
    setModifiee(false);
  }, []);
  const surTrait = useCallback(
    (trait: Trait) => {
      setHistorique((h) => ajouter(h, trait));
      oublierTexte();
    },
    [oublierTexte]
  );
  const surGomme = useCallback(
    (indices: number[]) => {
      setHistorique((h) => gommer(h, indices));
      oublierTexte();
    },
    [oublierTexte]
  );

  // Effacer toute la feuille = gommer tous les traits : annulable (« Annuler ») tant que
  // l'écran reste ouvert, et la feuille vide est supprimée côté serveur par la synchro.
  function effacerFeuille() {
    setHistorique((h) => gommer(h, h.traits.map((_, indice) => indice)));
    oublierTexte();
    setDialogue(null);
  }

  async function transcrire() {
    const depart = traitsCourants.current;
    setEnTranscription(true);
    try {
      // La feuille doit d'abord être arrivée sur le serveur : c'est lui qui garde le texte.
      const envoi = await synchroniserFeuilles();
      if (envoi.restantes > 0) {
        showErrorToast(envoi.refus[0] ?? "La feuille n'est pas encore envoyée au serveur : vérifie ta connexion puis réessaie.");
        return;
      }
      const tranches = await genererTranches(depart);
      if (!tranches) {
        showErrorToast("Il n'y a rien à transcrire : la feuille est vide.");
        return;
      }
      const formData = new FormData();
      tranches.blobs.forEach((blob, i) => formData.append("tranche", new File([blob], `tranche-${i + 1}.png`, { type: "image/png" })));
      const resultat = await runAction(() => transcrireFeuille(jour, formData), { erreur: "La transcription a échoué. Réessaie." });
      if (!resultat.ok) return;
      // Écrit pendant l'attente : le texte ne correspondrait plus à la feuille.
      if (traitsCourants.current !== depart) {
        showErrorToast("La feuille a changé pendant la transcription. Relance-la.");
        return;
      }
      setTranscription(resultat.data.texte);
      setModifiee(false);
      setDialogue("texte");
      showToast(tranches.tronquee ? "Texte transcrit. La feuille est longue : la fin n'a pas été lue." : "Texte transcrit");
    } finally {
      setEnTranscription(false);
    }
  }

  // Un texte corrigé à la main ne se remplace pas sans prévenir.
  function demanderTranscription() {
    if (transcription !== null && modifiee) setDialogue("retranscrire");
    else void transcrire();
  }

  // Fermer la fenêtre enregistre les corrections ; si l'enregistrement échoue, elle reste ouverte.
  async function fermerTexte(texte: string) {
    if (texte === transcription) {
      setDialogue(null);
      return;
    }
    const resultat = await runAction(() => enregistrerTranscription(jour, texte), {
      erreur: "Le texte n'a pas pu être enregistré. Réessaie.",
    });
    if (!resultat.ok) return;
    const propre = texte.trim();
    setTranscription(propre === "" ? null : propre);
    setModifiee(propre !== "");
    setDialogue(null);
    showToast(propre === "" ? "Texte supprimé" : "Texte enregistré");
  }

  async function supprimerTexte() {
    const resultat = await runAction(() => supprimerTranscription(jour), { erreur: "Le texte n'a pas pu être supprimé. Réessaie." });
    if (!resultat.ok) return;
    oublierTexte();
    setDialogue(null);
    showToast("Texte supprimé");
  }

  const estAujourdhui = jour === aujourdhui;
  const statut = enTranscription
    ? "Transcription en cours…"
    : enAttente > 0
      ? "Gardé sur ton téléphone, envoi en attente"
      : traits.length > 0
        ? "Enregistré"
        : "";

  return (
    <div className="flex flex-col gap-4">
      <TransitionLink href={retour.href} className={`${linkButton} self-start`}>
        ← {retour.libelle}
      </TransitionLink>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className={screenTitle}>{estAujourdhui ? "Vider ma tête" : "Feuille du soir"}</h1>
          <p className={eyebrow}>{libelleJour(jour)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TransitionLink href="/vider-ma-tete/calendrier" className={ghostButton}>
            Relire
          </TransitionLink>
          <MenuFeuille
            aTranscription={transcription !== null}
            enTranscription={enTranscription}
            peutTranscrire={traits.length > 0}
            peutEffacer={traits.length > 0}
            onTranscrire={demanderTranscription}
            onVoirTexte={() => setDialogue("texte")}
            onEffacer={() => setDialogue("effacer")}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink">Écrire aussi au doigt</span>
        <Switch checked={ecritAuDoigt} onToggle={() => ecrireDoigt(!ecritAuDoigt)} label="Écrire aussi au doigt" />
      </div>

      {pret ? (
        <FeuilleCanvas
          traits={traits}
          hauteur={hauteur}
          outil={outil}
          epaisseur={epaisseur}
          ecritAuDoigt={ecritAuDoigt}
          onTrait={surTrait}
          onGomme={surGomme}
        />
      ) : (
        <Skeleton className="h-[60vh] w-full rounded-[22px]" />
      )}

      <p className={`${eyebrow} min-h-5 text-center`} role="status" aria-live="polite" data-testid="vidage-statut">
        {statut}
      </p>

      <ConfirmDialog
        open={dialogue === "effacer"}
        titre="Effacer la feuille ?"
        confirmer="Effacer la feuille"
        onConfirm={effacerFeuille}
        onClose={() => setDialogue(null)}
      >
        <p>Tout ce que tu as écrit sur la feuille du {libelleJour(jour).toLowerCase()} sera retiré, ainsi que son texte transcrit.</p>
        <p>Tu pourras revenir en arrière avec « Annuler » tant que tu restes sur cet écran, mais le texte transcrit ne reviendra pas.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialogue === "supprimer-texte"}
        titre="Supprimer le texte ?"
        confirmer="Supprimer le texte"
        onConfirm={() => void supprimerTexte()}
        onClose={() => setDialogue(null)}
      >
        <p>Le texte transcrit sera supprimé. Ton écriture manuscrite reste intacte et tu pourras la transcrire à nouveau.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialogue === "retranscrire"}
        titre="Remplacer ton texte corrigé ?"
        confirmer="Retranscrire"
        onConfirm={() => {
          setDialogue(null);
          void transcrire();
        }}
        onClose={() => setDialogue(null)}
      >
        <p>Tu as corrigé ce texte à la main. Une nouvelle transcription le remplacera, sans retour possible.</p>
      </ConfirmDialog>

      <TranscriptionDialog
        open={dialogue === "texte" && transcription !== null}
        texte={transcription ?? ""}
        onFermer={(texte) => void fermerTexte(texte)}
        onSupprimer={() => setDialogue("supprimer-texte")}
      />

      <BarreOutils
        outil={outil}
        onOutil={setOutil}
        epaisseur={epaisseur}
        onEpaisseur={setEpaisseur}
        peutAnnuler={peutAnnuler(historique)}
        peutRetablir={peutRetablir(historique)}
        onAnnuler={() => {
          setHistorique(annuler);
          oublierTexte();
        }}
        onRetablir={() => {
          setHistorique(retablir);
          oublierTexte();
        }}
      />
    </div>
  );
}
