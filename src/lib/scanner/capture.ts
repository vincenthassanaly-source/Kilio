// Prise de photo pleine résolution depuis la caméra (ImageCapture.takePhoto).
//
// L'image du flux vidéo est plafonnée à ~2 Mpx (1920×1080), sans vraie mise au point : le
// texte fin y est flou et bruité. `takePhoto` déclenche la mise au point et renvoie une vraie
// photo du capteur (~12 Mpx), comme le fait CamScanner. Si le navigateur ne sait pas (iOS,
// Firefox) ou si la prise échoue ou tarde, on retombe sur l'image du flux : jamais de blocage.
//
// Les dépendances sont injectées : ce module ne touche ni au DOM ni à `window`, donc il se
// teste sans caméra.

/** Au-delà, la prise est abandonnée : mieux vaut l'image du flux qu'un viseur qui attend. */
const DELAI_PRISE_MS = 5000;
/** Plus grand côté demandé au capteur : une photo de 48 Mpx saturerait la mémoire d'un téléphone. */
const COTE_PHOTO_MAX_PX = 4096;

type Plage = { min?: number; max?: number };
type CapacitesPhoto = { imageWidth?: Plage; imageHeight?: Plage };
type OptionsPhoto = { imageWidth?: number; imageHeight?: number };

/** Sous-ensemble d'`ImageCapture` utilisé ici. */
export type CaptureurPhoto = {
  takePhoto: (options?: OptionsPhoto) => Promise<Blob>;
  getPhotoCapabilities?: () => Promise<CapacitesPhoto>;
};

export type FabriqueCaptureur = (piste: MediaStreamTrack) => CaptureurPhoto;

/** Fabrique d'`ImageCapture` du navigateur, ou null s'il n'existe pas. */
export function captureurDuNavigateur(): FabriqueCaptureur | null {
  const Ctor = (globalThis as { ImageCapture?: new (piste: MediaStreamTrack) => CaptureurPhoto }).ImageCapture;
  return Ctor ? (piste) => new Ctor(piste) : null;
}

/** Taille de photo à demander : la plus grande du capteur, bornée, en gardant ses proportions. */
export function optionsPhoto(cap: CapacitesPhoto | undefined): OptionsPhoto {
  const largeurMax = cap?.imageWidth?.max;
  const hauteurMax = cap?.imageHeight?.max;
  if (!largeurMax || !hauteurMax) return {};
  const echelle = Math.min(1, COTE_PHOTO_MAX_PX / Math.max(largeurMax, hauteurMax));
  return { imageWidth: Math.round(largeurMax * echelle), imageHeight: Math.round(hauteurMax * echelle) };
}

function avecDelai<T>(promesse: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const minuteur = setTimeout(() => reject(new Error("Prise de photo trop longue")), ms);
    promesse.then(
      (v) => {
        clearTimeout(minuteur);
        resolve(v);
      },
      (e) => {
        clearTimeout(minuteur);
        reject(e);
      }
    );
  });
}

/**
 * Photo pleine résolution de la piste vidéo, décodée par `charger`. Retombe sur `repli`
 * (image du flux) si `takePhoto` est absent, échoue, ou dépasse le délai.
 */
export async function capturerPhotoPleine<T>(
  piste: MediaStreamTrack | null,
  fabrique: FabriqueCaptureur | null,
  charger: (photo: Blob) => Promise<T>,
  repli: () => T,
  delaiMs = DELAI_PRISE_MS
): Promise<T> {
  if (!piste || !fabrique) return repli();
  try {
    const captureur = fabrique(piste);
    const photo = await avecDelai(
      (async () => {
        let options: OptionsPhoto = {};
        try {
          options = optionsPhoto(await captureur.getPhotoCapabilities?.());
        } catch {
          // Capacités illisibles : on prend la taille par défaut de l'appareil.
        }
        return captureur.takePhoto(options);
      })(),
      delaiMs
    );
    return await charger(photo);
  } catch {
    return repli();
  }
}
