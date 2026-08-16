"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";

// Le callback jwt (lib/auth/config.ts) ne rafraîchit le token QUE dans les
// 2 dernières minutes de sa validité (REFRESH_BUFFER). Déclencher `update()`
// plus tôt renvoie exactement la même session : un no-op qui repasse
// pourtant useSession() en `status === "loading"`. La fenêtre proactive doit
// donc tomber À L'INTÉRIEUR de celle du serveur pour que chaque update()
// produise réellement un nouveau token.
const SERVER_REFRESH_BUFFER = 2 * 60 * 1000; // doit rester = REFRESH_BUFFER (config.ts)
const PROACTIVE_REFRESH_BUFFER = SERVER_REFRESH_BUFFER - 30 * 1000; // 1 min 30

// Garde-fous au niveau module (et non `useRef`) : une ref est réinitialisée à
// chaque remontage du composant. Si une garde parente démonte l'arbre, le
// composant se remonte, la ref repart à zéro et l'action est rejouée en
// boucle. Ces drapeaux vivent le temps de la page.
/** Jeton pour lequel un refresh immédiat a déjà été demandé. */
let immediateRefreshRequestedFor: string | null = null;
/** Une déconnexion sur session expirée a déjà été déclenchée. */
let signOutRequested = false;

/**
 * Composant pour surveiller l'état de la session et synchroniser le token.
 *
 * 1. Écoute l'événement 'session-token-refreshed' émis par l'intercepteur axios
 *    après un refresh réussi via /api/auth/refresh, et appelle update() pour
 *    forcer useSession() à re-fetcher la session depuis le serveur (JWT cookie mis à jour).
 *
 * 2. Détecte les erreurs de refresh (RefreshAccessTokenError) et déconnecte l'utilisateur.
 * 
 * 3. Rafraîchit proactivement le token 1 min 30 avant son expiration pour éviter
 *    les interruptions lors d'une inactivité prolongée.
 */
export function SessionMonitor() {
  const { data: session, status, update } = useSession();
  const proactiveRefreshTimer = useRef<NodeJS.Timeout | null>(null);

  // `update` change d'identité à chaque mise à jour de session (next-auth le
  // recrée dans un useMemo sur [session, loading]). L'utiliser en dépendance
  // d'effet rearmait le timer de refresh proactif en boucle, si bien qu'il
  // n'arrivait jamais à échéance. On le garde dans une ref.
  const updateRef = useRef(update);
  updateRef.current = update;

  useEffect(() => {
    if (status === "unauthenticated") {
      signOutRequested = false;
      immediateRefreshRequestedFor = null;
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

    // Échéance réelle propagée par le callback session (lib/auth/config.ts).
    // Fallback à 25 minutes (sous les 30 min de durée de vie) si le champ
    // manque, par exemple sur une session créée avant cette version.
    const now = Date.now();
    const expiresAt = session.accessTokenExpires ?? now + 25 * 60 * 1000;

    const refreshAt = expiresAt - PROACTIVE_REFRESH_BUFFER;
    const delay = refreshAt - now;

    if (delay > 0) {
      console.log(`[SessionMonitor] Prochain refresh proactif dans ${Math.round(delay / 1000 / 60)} minutes`);
      proactiveRefreshTimer.current = setTimeout(() => {
        console.log("[SessionMonitor] Refresh proactif déclenché");
        immediateRefreshRequestedFor = session.accessToken ?? null;
        updateRef.current();
      }, delay);
    } else if (immediateRefreshRequestedFor !== session.accessToken) {
      // Token dans la fenêtre de rafraîchissement (ou déjà expiré) : refresh
      // immédiat, mais UNE SEULE FOIS par jeton. Sans ce verrou, un remontage
      // du composant relance update(), qui repasse la session en « loading »,
      // ce qui provoque un nouveau remontage : boucle infinie.
      console.log("[SessionMonitor] Token proche de l'expiration, refresh immédiat");
      immediateRefreshRequestedFor = session.accessToken ?? null;
      updateRef.current();
    }

    return () => {
      if (proactiveRefreshTimer.current) {
        clearTimeout(proactiveRefreshTimer.current);
        proactiveRefreshTimer.current = null;
      }
    };
  }, [session?.accessToken, session?.accessTokenExpires, session?.error]);

  // Détecter les erreurs de refresh et déconnecter (ne pas se baser sur l'absence
  // transitoire de accessToken : le JWT peut être en cours de mise à jour côté client).
  useEffect(() => {
    if (signOutRequested) return;

    const hasError = session?.error === "RefreshAccessTokenError";

    if (hasError) {
      signOutRequested = true;

      console.log("[SessionMonitor] Session expirée détectée, déconnexion...");
      signOut({
        redirect: true,
        callbackUrl: "/auth/login?error=SessionExpired",
      });
    }
  }, [session, status]);

  return null;
}
