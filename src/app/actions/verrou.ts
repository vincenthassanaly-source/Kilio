"use server";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  codeInscriptionValide,
  consommerDefi,
  exigerSession,
  fermerSession,
  inscriptionOuverte,
  memoriserDefi,
  origineAttendue,
  ouvrirSession,
  sessionValide,
  verrouConfigure,
  verrouDesactive,
} from "@/lib/vidage/verrou";

// Verrou biométrique de « Journal » : une passkey du téléphone (empreinte, visage, ou code
// de l'appareil en secours) enregistrée une seule fois — le premier appareil qui s'inscrit est le
// bon, voir scripts/migration-vidage-verrou-2026-10-21.sql — puis vérifiée par le serveur, qui
// ouvre alors une session de 15 minutes (cookie signé, voir lib/vidage/verrou.ts).
// L'enrôlement exige en plus le code VIDAGE_INSCRIPTION_CODE : sans lui, tant que la table est
// vide (première mise en service, changement de téléphone), n'importe qui pourrait s'inscrire
// avant Vincent. Seul `optionsInscription` le vérifie : `verifierInscription` ne passe que par le
// défi signé qu'elle émet.

export type EtatVerrou = {
  /** Faux tant que VIDAGE_SESSION_SECRET n'est pas défini côté serveur. */
  configure: boolean;
  /** Un appareil est déjà enregistré. */
  inscrit: boolean;
  /** Faux tant que VIDAGE_INSCRIPTION_CODE n'est pas défini côté serveur : aucun appareil ne peut s'enregistrer. */
  inscriptionOuverte: boolean;
  /** La session de 15 minutes est ouverte. */
  ouvert: boolean;
};

const MESSAGE_NON_CONFIGURE = "Le verrou n'est pas configuré : il manque VIDAGE_SESSION_SECRET côté serveur.";
const MESSAGE_INSCRIPTION_FERMEE =
  "L'enregistrement est fermé : il manque VIDAGE_INSCRIPTION_CODE (16 caractères minimum) côté serveur.";
const MESSAGE_CODE_INCORRECT = "Code d'enregistrement incorrect.";
const MESSAGE_DEFI_PERIME ="La demande a expiré. Recommence.";
const MESSAGE_NON_RECONNU = "L'empreinte n'a pas été reconnue. Réessaie.";

type Cle = { credential_id: string; public_key: string; counter: number; transports: string[] | null };

async function lireCle(): Promise<{ cle: Cle | null; erreur: boolean }> {
  const { data, error } = await createAdminClient()
    .from("vidage_passkey")
    .select("credential_id, public_key, counter, transports")
    .eq("id", 1)
    .maybeSingle();
  return { cle: data ?? null, erreur: Boolean(error) };
}

export async function etatVerrou(): Promise<ActionResult<EtatVerrou>> {
  if (verrouDesactive()) return ok({ configure: true, inscrit: true, inscriptionOuverte: true, ouvert: true });
  if (!verrouConfigure()) return ok({ configure: false, inscrit: false, inscriptionOuverte: false, ouvert: false });
  const { cle, erreur } = await lireCle();
  if (erreur) return fail("Le verrou n'a pas pu être vérifié. Réessaie.");
  return ok({ configure: true, inscrit: cle !== null, inscriptionOuverte: inscriptionOuverte(), ouvert: await sessionValide() });
}

/**
 * Premier appareil : demande de création de la passkey. Exige le code d'enrôlement du serveur et
 * est refusée dès qu'un appareil est enregistré.
 */
export async function optionsInscription(code: string): Promise<ActionResult<PublicKeyCredentialCreationOptionsJSON>> {
  if (!verrouConfigure()) return fail(MESSAGE_NON_CONFIGURE);
  if (!inscriptionOuverte()) return fail(MESSAGE_INSCRIPTION_FERMEE);
  if (!codeInscriptionValide(code)) return fail(MESSAGE_CODE_INCORRECT);
  const { cle, erreur } = await lireCle();
  if (erreur) return fail("Le verrou n'a pas pu être vérifié. Réessaie.");
  if (cle) return fail("Un appareil est déjà enregistré.");

  const { rpID } = await origineAttendue();
  const options = await generateRegistrationOptions({
    rpName: "Kilio",
    rpID,
    userName: "kilio",
    userID: new TextEncoder().encode("kilio"),
    attestationType: "none",
    // Capteur de l'appareil uniquement, avec vérification obligatoire (empreinte, visage ou code).
    authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" },
  });
  if (!(await memoriserDefi(options.challenge, "inscription"))) return fail(MESSAGE_NON_CONFIGURE);
  return ok(options);
}

export async function verifierInscription(reponse: RegistrationResponseJSON): Promise<ActionResult> {
  if (!verrouConfigure()) return fail(MESSAGE_NON_CONFIGURE);
  const defi = await consommerDefi("inscription");
  if (!defi) return fail(MESSAGE_DEFI_PERIME);

  const { rpID, origin } = await origineAttendue();
  let verifiee;
  try {
    verifiee = await verifyRegistrationResponse({
      response: reponse,
      expectedChallenge: defi,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return fail(MESSAGE_NON_RECONNU);
  }
  if (!verifiee.verified) return fail(MESSAGE_NON_RECONNU);

  const { credential } = verifiee.registrationInfo;
  // La clé primaire (id = 1) garantit qu'un seul appareil s'inscrit, même en cas de course.
  const { error } = await createAdminClient()
    .from("vidage_passkey")
    .insert({
      id: 1,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? null,
    });
  if (error) return fail("Un appareil est déjà enregistré.");
  await ouvrirSession();
  return ok();
}

/** Demande de lecture biométrique pour l'appareil enregistré. */
export async function optionsConnexion(): Promise<ActionResult<PublicKeyCredentialRequestOptionsJSON>> {
  if (!verrouConfigure()) return fail(MESSAGE_NON_CONFIGURE);
  const { cle, erreur } = await lireCle();
  if (erreur) return fail("Le verrou n'a pas pu être vérifié. Réessaie.");
  if (!cle) return fail("Aucun appareil n'est enregistré.");

  const { rpID } = await origineAttendue();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [{ id: cle.credential_id, transports: (cle.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined }],
    userVerification: "required",
  });
  if (!(await memoriserDefi(options.challenge, "connexion"))) return fail(MESSAGE_NON_CONFIGURE);
  return ok(options);
}

export async function verifierConnexion(reponse: AuthenticationResponseJSON): Promise<ActionResult> {
  if (!verrouConfigure()) return fail(MESSAGE_NON_CONFIGURE);
  const defi = await consommerDefi("connexion");
  if (!defi) return fail(MESSAGE_DEFI_PERIME);
  const { cle, erreur } = await lireCle();
  if (erreur || !cle) return fail("Le verrou n'a pas pu être vérifié. Réessaie.");

  const { rpID, origin } = await origineAttendue();
  let verifiee;
  try {
    verifiee = await verifyAuthenticationResponse({
      response: reponse,
      expectedChallenge: defi,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cle.credential_id,
        publicKey: new Uint8Array(Buffer.from(cle.public_key, "base64url")),
        counter: cle.counter,
        transports: (cle.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
      },
      requireUserVerification: true,
    });
  } catch {
    return fail(MESSAGE_NON_RECONNU);
  }
  if (!verifiee.verified) return fail(MESSAGE_NON_RECONNU);

  // Meilleur effort : le compteur détecte une passkey clonée, mais ne doit pas bloquer l'entrée.
  await createAdminClient().from("vidage_passkey").update({ counter: verifiee.authenticationInfo.newCounter }).eq("id", 1);
  await ouvrirSession();
  return ok();
}

/** Appelée pendant l'activité : repousse la fin de la session de 15 minutes. */
export async function prolongerSession(): Promise<ActionResult> {
  return exigerSession();
}

export async function verrouiller(): Promise<ActionResult> {
  await fermerSession();
  return ok();
}
