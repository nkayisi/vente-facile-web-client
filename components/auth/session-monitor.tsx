"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";

/**
 * Composant pour surveiller l'état de la session et synchroniser le token.
 *
 * 1. Écoute l'événement 'session-token-refreshed' émis par l'intercepteur axios
 *    après un refresh réussi via /api/auth/refresh, et appelle update() pour
 *    forcer useSession() à re-fetcher la session depuis le serveur (JWT cookie mis à jour).
 *
 * 2. Détecte les erreurs de refresh (RefreshAccessTokenError) et déconnecte l'utilisateur.
 */
export function SessionMonitor() {
  const { data: session, status, update } = useSession();
  const hasShownError = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      hasShownError.current = false;
    }
  }, [status]);

  // Forcer la mise à jour de la session côté client quand le token a été rafraîchi côté serveur
  const handleTokenRefreshed = useCallback(() => {
    console.log("[SessionMonitor] Token rafraîchi côté serveur, mise à jour de la session client...");
    update();
  }, [update]);

  useEffect(() => {
    window.addEventListener("session-token-refreshed", handleTokenRefreshed);
    return () => {
      window.removeEventListener("session-token-refreshed", handleTokenRefreshed);
    };
  }, [handleTokenRefreshed]);

  // Détecter les erreurs de refresh et déconnecter (ne pas se baser sur l'absence
  // transitoire de accessToken : le JWT peut être en cours de mise à jour côté client).
  useEffect(() => {
    if (hasShownError.current) return;

    const hasError = session?.error === "RefreshAccessTokenError";

    if (hasError) {
      hasShownError.current = true;

      console.log("[SessionMonitor] Session expirée détectée, déconnexion...");
      signOut({
        redirect: true,
        callbackUrl: "/auth/login?error=SessionExpired",
      });
    }
  }, [session, status]);

  return null;
}
