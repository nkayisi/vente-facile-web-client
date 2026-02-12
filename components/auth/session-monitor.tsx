"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";

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

  // Détecter les erreurs de refresh et déconnecter
  useEffect(() => {
    if (hasShownError.current) return;

    const hasError = session?.error === "RefreshAccessTokenError";
    const hasNoToken = status === "authenticated" && !session?.accessToken;

    if (hasError || hasNoToken) {
      hasShownError.current = true;

      console.log("[SessionMonitor] Session expirée détectée, déconnexion...");
      toast.error("Votre session a expiré. Veuillez vous reconnecter.");

      signOut({
        redirect: true,
        callbackUrl: "/auth/login?error=SessionExpired",
      });
    }
  }, [session, status]);

  return null;
}
