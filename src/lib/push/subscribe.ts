"use client";

import { deleteSubscription, saveSubscription } from "@/app/actions/notifications";

// applicationServerKey attend un Uint8Array, pas la chaîne base64url brute
// exposée par la variable d'env — conversion standard documentée par le
// Push API (cf. MDN "urlBase64ToUint8Array").
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Les notifications push ne sont pas supportées par ce navigateur.");
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("Clé VAPID publique manquante (NEXT_PUBLIC_VAPID_PUBLIC_KEY).");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permission de notification refusée.");
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    await subscription.unsubscribe().catch(() => undefined);
    throw new Error("Abonnement push invalide.");
  }

  try {
    await saveSubscription({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
  } catch (erreur) {
    // Sans cela, le navigateur garde un abonnement inconnu du serveur :
    // l'interface croit les notifications actives alors qu'aucune n'arrivera.
    await subscription.unsubscribe().catch(() => undefined);
    throw erreur;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingSubscription();
  if (!subscription) return;

  await deleteSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}
