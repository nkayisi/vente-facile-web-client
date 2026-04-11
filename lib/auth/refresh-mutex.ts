import type { JWT } from "next-auth/jwt";

/**
 * Mutex pour sérialiser les appels de refresh token.
 * 
 * Problème résolu : Avec ROTATE_REFRESH_TOKENS=True côté backend,
 * chaque refresh invalide l'ancien token. Si deux requêtes simultanées
 * tentent de rafraîchir avec le même token, la seconde échouera car
 * son token aura été blacklisté par la première.
 * 
 * Solution : On stocke la promesse de refresh en cours. Si un second
 * appel arrive pendant qu'un refresh est en cours, il attend le résultat
 * du premier au lieu de lancer un nouveau refresh.
 */

let refreshPromise: Promise<JWT> | null = null;
let lastRefreshTime = 0;
const MIN_REFRESH_INTERVAL = 1000; // 1 seconde minimum entre deux refresh

export async function refreshWithMutex(
  token: JWT,
  refreshFn: (token: JWT) => Promise<JWT>
): Promise<JWT> {
  const now = Date.now();
  
  // Si un refresh est déjà en cours, attendre son résultat
  if (refreshPromise) {
    console.log("[RefreshMutex] Refresh déjà en cours, attente du résultat...");
    return refreshPromise;
  }
  
  // Éviter les refresh trop rapprochés (protection supplémentaire)
  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    console.log("[RefreshMutex] Refresh trop récent, skip");
    return token;
  }
  
  // Lancer le refresh et stocker la promesse
  console.log("[RefreshMutex] Démarrage d'un nouveau refresh");
  lastRefreshTime = now;
  
  refreshPromise = refreshFn(token);
  
  try {
    const result = await refreshPromise;
    console.log("[RefreshMutex] Refresh terminé avec succès");
    return result;
  } catch (error) {
    console.error("[RefreshMutex] Erreur lors du refresh:", error);
    throw error;
  } finally {
    // Libérer le mutex après un court délai pour éviter les race conditions
    setTimeout(() => {
      refreshPromise = null;
    }, 100);
  }
}

/**
 * Réinitialise le mutex (utile pour les tests ou après une déconnexion)
 */
export function resetRefreshMutex(): void {
  refreshPromise = null;
  lastRefreshTime = 0;
}
