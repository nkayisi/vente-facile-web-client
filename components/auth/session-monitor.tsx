"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";

// Rafraîchir 5 minutes avant l'expiration du token
const PROACTIVE_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes

/**
 * Composant pour surveiller l'état de la session et synchroniser le token.
 *
 * 1. Écoute l'événement 'session-token-refreshed' émis par l'intercepteur axios
 *    après un refresh réussi via /api/auth/refresh, et appelle update() pour
 *    forcer useSession() à re-fetcher la session depuis le serveur (JWT cookie mis à jour).
 *
 * 2. Détecte les erreurs de refresh (RefreshAccessTokenError) et déconnecte l'utilisateur.
 * 
 * 3. Rafraîchit proactivement le token 5 minutes avant son expiration pour éviter
 *    les interruptions lors d'une inactivité prolongée.
 */
export function SessionMonitor() {
  const { data: session, status, update } = useSession();
  const hasShownError = useRef(false);
  const proactiveRefreshTimer = useRef<NodeJS.Timeout | null>(null);

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

  // Refresh proactif : programmer un refresh avant l'expiration du token
  useEffect(() => {
    // Nettoyer le timer précédent
    if (proactiveRefreshTimer.current) {
      clearTimeout(proactiveRefreshTimer.current);
      proactiveRefreshTimer.current = null;
    }

    // Ne pas programmer si pas de session ou erreur
    if (!session?.accessToken || session?.error) {
      return;
    }

    // Récupérer l'expiration depuis la session (si disponible)
    // Note: accessTokenExpires n'est pas exposé par défaut dans la session client,
    // donc on utilise un fallback de 25 minutes (30 min - 5 min buffer)
    const now = Date.now();
    const defaultExpiry = now + 25 * 60 * 1000; // 25 minutes par défaut
    const expiresAt = (session as any).accessTokenExpires || defaultExpiry;

    const refreshAt = expiresAt - PROACTIVE_REFRESH_BUFFER;
    const delay = refreshAt - now;

    if (delay > 0) {
      console.log(`[SessionMonitor] Prochain refresh proactif dans ${Math.round(delay / 1000 / 60)} minutes`);
      proactiveRefreshTimer.current = setTimeout(() => {
        console.log("[SessionMonitor] Refresh proactif déclenché");
        update();
      }, delay);
    } else if (delay > -PROACTIVE_REFRESH_BUFFER) {
      // Token proche de l'expiration, refresh immédiat
      console.log("[SessionMonitor] Token proche de l'expiration, refresh immédiat");
      update();
    }

    return () => {
      if (proactiveRefreshTimer.current) {
        clearTimeout(proactiveRefreshTimer.current);
        proactiveRefreshTimer.current = null;
      }
    };
  }, [session?.accessToken, session?.error, update]);

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
