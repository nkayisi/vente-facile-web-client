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
  
  // Lancer le refresh et stocker la promesse.
  // Important : on libère le mutex DANS le `then`/`catch` final (pas via
  // setTimeout) pour garantir que toute requête concurrente qui voit
  // `refreshPromise != null` attend bien la fin du refresh. Le setTimeout
  // précédent introduisait une fenêtre probabiliste où une seconde requête
  // pouvait passer le check (ligne 27), démarrer un nouveau refresh, et
  // invalider le premier token (ROTATE_REFRESH_TOKENS).
  console.log("[RefreshMutex] Démarrage d'un nouveau refresh");
  lastRefreshTime = now;

  const promise = refreshFn(token).finally(() => {
    // Libération synchrone : si la promesse stockée est toujours celle-ci,
    // on la déréférence. Toute requête qui aurait pris une référence à
    // `refreshPromise` (ligne 27/29) résoudra avec le même résultat que
    // ce caller.
    if (refreshPromise === promise) {
      refreshPromise = null;
    }
  });
  refreshPromise = promise;

  try {
    const result = await promise;
    console.log("[RefreshMutex] Refresh terminé avec succès");
    return result;
  } catch (error) {
    console.error("[RefreshMutex] Erreur lors du refresh:", error);
    throw error;
  }
}

/**
 * Réinitialise le mutex (utile pour les tests ou après une déconnexion)
 */
export function resetRefreshMutex(): void {
  refreshPromise = null;
  lastRefreshTime = 0;
}
