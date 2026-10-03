#!/usr/bin/env python3
"""Extraction des poses (départ / arrivée) des exercices du module Sport.

Pour chacune des paires de photos de free-exercise-db (domaine public), une
détection de pose MediaPipe donne la position de 15 articulations. Les deux
poses d'un exercice sont recadrées ensemble dans un repère commun (viewBox
200 × 260 de l'illustration) pour que l'animation ne « saute » pas.

Usage :
  python3 scripts/sport/poses/extraire_poses.py <dossier-travail> [--limite N]

Écrit dans <dossier-travail> :
  telechargements/   photos d'origine (cache, rejouable)
  poses.json         { id: { v, a, b, confiance, statut, raisons } }

Rejouable : les photos et le modèle déjà téléchargés sont réutilisés.
Dépendances : pip install mediapipe opencv-python-headless numpy
"""
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

RACINE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main"
MODELE_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task"

# Ordre des articulations stockées (G/D = côté gauche/droit du sujet).
ARTICULATIONS = [
    "tete", "epauleG", "epauleD", "coudeG", "coudeD", "poignetG", "poignetD",
    "hancheG", "hancheD", "genouG", "genouD", "chevilleG", "chevilleD", "pointeG", "pointeD",
]
# Indices MediaPipe correspondants ; la tête est la moyenne nez + oreilles.
INDICES = [None, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32]
OREILLES_NEZ = [0, 7, 8]

# Repère de sortie : l'illustration tient dans 160 × 200 au centre d'un 200 × 260.
LARGEUR, HAUTEUR, MARGE_X, MARGE_Y = 200.0, 260.0, 20.0, 30.0

SEUIL_VISIBILITE = 0.5    # visibilité moyenne minimale d'une pose
TOLERANCE_ECHELLE = 0.12  # au-delà, la 2e pose est recalée sur la taille de la 1re
SEUIL_ECHELLE = 0.4       # écart de longueur des membres, après recalage, au-delà duquel on valide à la main


def telecharger(url: str, destination: Path) -> bool:
    if destination.exists() and destination.stat().st_size > 0:
        return True
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            destination.write_bytes(r.read())
        return True
    except Exception as e:  # noqa: BLE001 - un échec réseau isolé ne doit pas tout arrêter
        print(f"  ! {url} : {e}", file=sys.stderr)
        return False


def detecter(detecteur, chemin: Path):
    """Retourne (points px [15][2], visibilité moyenne, nb de personnes) ou None."""
    image = cv2.imread(str(chemin))
    if image is None:
        return None
    h, w = image.shape[:2]
    rgb = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    res = detecteur.detect(rgb)
    if not res.pose_landmarks:
        return None
    pts = res.pose_landmarks[0]
    points, visibilites = [], []
    for idx in INDICES:
        if idx is None:
            ref = [pts[i] for i in OREILLES_NEZ]
            points.append([sum(p.x for p in ref) / 3 * w, sum(p.y for p in ref) / 3 * h])
            visibilites.append(min(p.visibility for p in ref))
        else:
            points.append([pts[idx].x * w, pts[idx].y * h])
            visibilites.append(pts[idx].visibility)
    return np.array(points), float(np.mean(visibilites)), len(res.pose_landmarks)


def longueur_tronc(p: np.ndarray) -> float:
    epaules = (p[1] + p[2]) / 2
    hanches = (p[7] + p[8]) / 2
    return float(np.linalg.norm(epaules - hanches))


SEGMENTS_MEMBRES = [(7, 9), (9, 11), (8, 10), (10, 12), (1, 3), (3, 5), (2, 4), (4, 6)]


def longueur_membres(p: np.ndarray) -> float:
    return float(sum(np.linalg.norm(p[i] - p[j]) for i, j in SEGMENTS_MEMBRES))


def recaler(reference: np.ndarray, pose: np.ndarray) -> np.ndarray:
    """Photos cadrées à des zooms différents : remet `pose` à l'échelle du tronc de
    `reference`, autour du milieu des chevilles (les pieds restent au sol)."""
    echelle = float(np.clip(longueur_tronc(reference) / max(longueur_tronc(pose), 1e-6), 0.4, 2.5))
    ancre_ref = (reference[11] + reference[12]) / 2
    ancre = (pose[11] + pose[12]) / 2
    return (pose - ancre) * echelle + ancre_ref


def recadrer(poses: list[np.ndarray]) -> list[list[list[float]]]:
    """Met toutes les poses dans le repère commun, sans déformer."""
    tout = np.vstack(poses)
    mini, maxi = tout.min(axis=0), tout.max(axis=0)
    etendue = np.maximum(maxi - mini, 1e-6)
    echelle = min((LARGEUR - 2 * MARGE_X) / etendue[0], (HAUTEUR - 2 * MARGE_Y) / etendue[1])
    decalage = np.array([LARGEUR, HAUTEUR]) / 2 - (mini + maxi) / 2 * echelle
    return [np.round(p * echelle + decalage, 1).tolist() for p in poses]


def main() -> None:
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    travail = Path(args[0]).resolve()
    limite = int(args[args.index("--limite") + 1]) if "--limite" in args else None
    travail.mkdir(parents=True, exist_ok=True)

    modele = travail / "pose_landmarker_heavy.task"
    if not telecharger(MODELE_URL, modele):
        sys.exit("modèle indisponible")
    exercices_json = travail / "exercises.json"
    if not telecharger(f"{RACINE}/dist/exercises.json", exercices_json):
        sys.exit("jeu de données indisponible")
    exercices = json.loads(exercices_json.read_text())
    if limite:
        exercices = exercices[:limite]

    taches = [(e["id"], i, src) for e in exercices for i, src in enumerate(e["images"])]
    print(f"{len(exercices)} exercices, {len(taches)} photos")
    with ThreadPoolExecutor(8) as pool:
        list(pool.map(lambda t: telecharger(f"{RACINE}/exercises/{t[2]}", travail / "telechargements" / t[0] / f"{t[1]}.jpg"), taches))

    options = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(modele)),
        running_mode=vision.RunningMode.IMAGE,
        num_poses=2,
        min_pose_detection_confidence=0.3,
    )
    sortie, statuts = {}, {"auto": 0, "a_valider": 0}
    with vision.PoseLandmarker.create_from_options(options) as detecteur:
        for n, e in enumerate(exercices, 1):
            vues = [detecter(detecteur, travail / "telechargements" / e["id"] / f"{i}.jpg") for i in range(len(e["images"]))]
            ok = [v for v in vues if v is not None]
            raisons = []
            if len(ok) == 0:
                sortie[e["id"]] = {"v": 1, "statut": "a_valider", "confiance": 0, "raisons": ["aucune pose détectée"]}
                statuts["a_valider"] += 1
                continue
            if len(ok) < len(e["images"]):
                raisons.append("une photo sans pose détectée")
            if len(e["images"]) < 2:
                raisons.append("une seule photo")
            if any(v[2] > 1 for v in ok):
                raisons.append("plusieurs personnes")
            # Une photo manquante / unique : la pose est dupliquée (illustration fixe).
            pa = ok[0][0]
            pb = ok[1][0] if len(ok) > 1 else ok[0][0]
            visibilite = min(v[1] for v in ok)
            if visibilite < SEUIL_VISIBILITE:
                raisons.append(f"visibilité faible ({visibilite:.2f})")
            ta, tb = longueur_tronc(pa), longueur_tronc(pb)
            if max(ta, tb) < 1:
                raisons.append("tronc quasi nul (vue de face écrasée ?)")
            elif abs(ta - tb) / max(ta, tb) > TOLERANCE_ECHELLE:
                pb = recaler(pa, pb)
                # Après recalage, les membres doivent avoir la même longueur d'une pose à l'autre.
                if abs(longueur_membres(pa) / max(longueur_membres(pb), 1e-6) - 1) > SEUIL_ECHELLE:
                    raisons.append("tailles incohérentes entre les 2 photos, même recalées")
            a, b = recadrer([pa, pb])
            statut = "auto" if not raisons else "a_valider"
            statuts[statut] += 1
            sortie[e["id"]] = {"v": 1, "a": a, "b": b, "confiance": round(visibilite, 3), "statut": statut, "raisons": raisons}
            if n % 100 == 0:
                print(f"{n}/{len(exercices)}  {statuts}")
    (travail / "poses.json").write_text(json.dumps(sortie, ensure_ascii=False))
    print(f"terminé : {statuts} -> {travail / 'poses.json'}")


if __name__ == "__main__":
    main()
