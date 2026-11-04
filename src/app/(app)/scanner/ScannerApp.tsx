"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ajouterPage,
  listerPages,
  mettreAJourFiltre,
  supprimerPage,
  viderBrouillon,
  type PageBrouillon,
} from "@/lib/scanner/brouillon";
import type { Filtre } from "@/lib/scanner/filtres";
import type { Quad } from "@/lib/scanner/geometrie";
import { chargerImage, creerPage, refiltrer } from "@/lib/scanner/traitement";
import { card, dangerButton, errorText, ghostButton, primaryButton, secondaryButton } from "@/lib/ui";
import { EditeurCoins } from "./EditeurCoins";
import { ExportPanel } from "./ExportPanel";
import { Viseur } from "./Viseur";

/** Les quatre filtres proposés : texte court affiché, et nom complet pour les lecteurs d'écran. */
const FILTRES: { valeur: Filtre; texte: string; nom: string }[] = [
  { valeur: "original", texte: "Original", nom: "Original" },
  { valeur: "noirblanc", texte: "N&B", nom: "Noir et blanc" },
  { valeur: "couleurs", texte: "Couleurs", nom: "Couleurs fidèles" },
  { valeur: "magic", texte: "Magic color", nom: "Magic color" },
];

/**
 * Miniature d'une page : l'URL d'objet est créée dans l'effet et publiée au
 * frame suivant, puis révoquée au nettoyage (sûr même quand React rejoue les
 * effets en mode strict : un nettoyage avant publication annule la publication).
 */
function Miniature({ page, numero }: { page: PageBrouillon; numero: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objet = URL.createObjectURL(page.traite);
    const frame = requestAnimationFrame(() => setUrl(objet));
    return () => {
      cancelAnimationFrame(frame);
      URL.revokeObjectURL(objet);
    };
  }, [page.traite]);
  const ratio = { aspectRatio: `${page.largeur} / ${page.hauteur}` };
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- miniature locale (blob:)
    <img src={url} alt={`Page ${numero}`} className="w-full rounded-lg border border-line bg-white object-contain" style={ratio} />
  ) : (
    <div className="w-full rounded-lg bg-surface-alt" style={ratio} />
  );
}

export function ScannerApp() {
  const [pages, setPages] = useState<PageBrouillon[]>([]);
  const [charge, setCharge] = useState(false);
  const [viseurOuvert, setViseurOuvert] = useState(false);
  /** Photos en attente de recadrage (la première est à l'écran). */
  const [file, setFile] = useState<{ id: number; image: ImageData }[]>([]);
  const prochainId = useRef(0);
  /** Page à remplacer par la prochaine validée (« Reprendre »). */
  const [remplacerId, setRemplacerId] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurRecadrage, setErreurRecadrage] = useState<string | null>(null);
  const [filtreEnCours, setFiltreEnCours] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const recharger = useCallback(async () => {
    setPages(await listerPages());
  }, []);

  useEffect(() => {
    let annule = false;
    listerPages()
      .then((p) => {
        if (!annule) setPages(p);
      })
      .catch(() => {
        if (!annule) setErreur("Le brouillon local est inaccessible (navigation privée ?). Les pages ne seront pas conservées.");
      })
      .finally(() => {
        if (!annule) setCharge(true);
      });
    return () => {
      annule = true;
    };
  }, []);

  function ouvrirViseur(idARemplacer: string | null = null) {
    setErreur(null);
    setRemplacerId(idARemplacer);
    setViseurOuvert(true);
  }

  function fermerViseur() {
    setViseurOuvert(false);
    setRemplacerId(null);
  }

  function mettreEnFile(images: ImageData[]) {
    if (images.length === 0) return;
    setErreurRecadrage(null);
    const nouvelles = images.map((image) => ({ id: prochainId.current++, image }));
    setFile((f) => [...f, ...nouvelles]);
  }

  async function surImport(e: React.ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (fichiers.length === 0) return;
    setErreur(null);
    try {
      const images: ImageData[] = [];
      for (const f of fichiers) images.push(await chargerImage(f));
      mettreEnFile(images);
    } catch {
      setErreur("Impossible de lire cette image.");
    }
  }

  async function valider(quad: Quad) {
    const source = file[0]?.image;
    if (!source) return;
    setEnCours(true);
    setErreurRecadrage(null);
    try {
      // Filtre « auto » : Couleurs fidèles pour une carte, Noir & blanc pour une feuille.
      const page = await creerPage(source, quad, "auto");
      await ajouterPage(page, remplacerId ?? undefined);
      await recharger();
      // Une page « reprise » est remplacée : on revient à la liste.
      if (remplacerId) fermerViseur();
      setRemplacerId(null);
      setFile((f) => f.slice(1));
    } catch (e) {
      setErreurRecadrage(e instanceof Error ? e.message : "Le traitement de la page a échoué.");
    } finally {
      setEnCours(false);
    }
  }

  function annulerRecadrage() {
    // Annuler abandonne la photo en cours ; les suivantes de la file restent à traiter.
    setFile((f) => f.slice(1));
  }

  async function supprimer(id: string) {
    await supprimerPage(id);
    await recharger();
  }

  async function changerFiltre(page: PageBrouillon, filtre: Filtre) {
    if (page.filtre === filtre || filtreEnCours) return;
    setFiltreEnCours(page.id);
    setErreur(null);
    try {
      const traite = await refiltrer(page.redresse, filtre);
      await mettreAJourFiltre(page.id, filtre, traite);
      await recharger();
    } catch {
      setErreur("Impossible d'appliquer ce filtre.");
    } finally {
      setFiltreEnCours(null);
    }
  }

  async function vider() {
    await viderBrouillon();
    await recharger();
  }

  const ouvrirSelecteur = () => importRef.current?.click();

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={importRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={surImport}
        aria-label="Importer des photos"
      />

      <p className="text-sm text-ink-2">
        Photographie tes documents, recadre-les, puis exporte-les en PDF ou en images. Rien n&apos;est envoyé en ligne : les pages restent sur cet appareil.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={primaryButton} onClick={() => ouvrirViseur()}>
          Scanner
        </button>
        <button type="button" className={secondaryButton} onClick={ouvrirSelecteur}>
          Importer
        </button>
      </div>

      {erreur && <p role="alert" className={errorText}>{erreur}</p>}

      {charge && pages.length === 0 && (
        <div className={`${card} text-center text-sm text-ink-3`}>Aucune page pour l&apos;instant. Appuie sur « Scanner » pour commencer.</div>
      )}

      {pages.length > 0 && (
        <ol className="flex flex-col gap-3" aria-label="Pages scannées">
          {pages.map((p, i) => (
            <li key={p.id} className={`${card} flex flex-col gap-3`}>
              <div className="flex gap-3">
                <div className="w-24 shrink-0">
                  <Miniature page={p} numero={i + 1} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">Page {i + 1}</p>
                  <div className="flex gap-2">
                    <button type="button" className={ghostButton} onClick={() => ouvrirViseur(p.id)}>
                      Reprendre
                    </button>
                    <button type="button" className={dangerButton} onClick={() => supprimer(p.id)} aria-label={`Supprimer la page ${i + 1}`}>
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
              {/* Quatre filtres sur toute la largeur de la carte (2×2 sur petit écran) : « Magic color » ne tient pas à côté de la miniature. */}
              <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4" role="group" aria-label={`Filtre de la page ${i + 1}`}>
                {FILTRES.map(({ valeur, texte, nom }) => (
                  <button
                    key={valeur}
                    type="button"
                    aria-pressed={p.filtre === valeur}
                    aria-label={nom}
                    disabled={filtreEnCours === p.id}
                    onClick={() => changerFiltre(p, valeur)}
                    className={`${p.filtre === valeur ? "bg-kcal text-on-kcal" : "border border-line bg-surface text-ink"} min-h-11 rounded-xl px-1.5 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-60`}
                  >
                    {texte}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      {pages.length > 0 && <ExportPanel pages={pages} onVider={vider} />}

      {viseurOuvert && (
        <Viseur
          nombrePages={pages.length}
          enPause={file.length > 0}
          onCapture={(image) => mettreEnFile([image])}
          onImporter={ouvrirSelecteur}
          onClose={fermerViseur}
        />
      )}

      {file.length > 0 && (
        <EditeurCoins
          cle={file[0].id}
          source={file[0].image}
          restantes={file.length - 1}
          enCours={enCours}
          erreur={erreurRecadrage}
          onValider={valider}
          onAnnuler={annulerRecadrage}
          onFermer={() => {
            // Retour navigateur ou Échap : on abandonne toute la file (le
            // viseur éventuel reste ouvert dessous, avec sa page à remplacer).
            setFile([]);
          }}
        />
      )}
    </div>
  );
}
