import type { JWT } from "next-auth/jwt";

/**
 * Sérialise et mémorise les refresh de token.
 *
 * Problème résolu : le backend a ROTATE_REFRESH_TOKENS + BLACKLIST. Chaque
 * refresh réussi bannit le refresh token consommé. Deux cas produisent alors
 * un 401 « Le jeton a été banni », qui se propage en RefreshAccessTokenError
 * et déconnecte l'utilisateur :
 *
 *  1. Deux requêtes rafraîchissent EN MÊME TEMPS avec le même token. La
 *     seconde perd la course.
 *  2. Une requête rafraîchit APRÈS qu'une autre a déjà tourné le token, mais
 *     en portant encore l'ancien cookie de session (onglet resté ouvert,
 *     requête déjà en vol, server action partie avant la mise à jour du
 *     cookie). Elle rejoue un refresh token déjà banni.
 *
 * Le cas 1 se règle avec une promesse partagée, le cas 2 avec un cache de
 * résultat : on mémorise, pour un refresh token donné, le JWT produit. Toute
 * requête ultérieure qui présente ce même (ancien) token récupère le résultat
 * au lieu d'appeler le backend. La fenêtre est courte, le temps que le cookie
 * de session se propage à tous les appelants.
 *
 * Portée : mémoire du process Next. Suffisant pour un déploiement à une
 * instance (cas actuel). Avec plusieurs instances, il faudrait déporter le
 * cache dans Redis, sinon le cas 2 réapparaît entre instances.
 */

type RefreshFn = (token: JWT) => Promise<JWT>;

/** Durée de réutilisation du résultat par un porteur de l'ancien token. */
const RESULT_TTL_MS = 60 * 1000;
/** Garde-fou mémoire : au-delà, on purge les entrées les plus anciennes. */
const MAX_RESULTS = 50;

/** Refresh en cours, indexés par le refresh token consommé. */
const inFlight = new Map<string, Promise<JWT>>();
/** Résultats récents, indexés par le refresh token consommé. */
const results = new Map<string, { jwt: JWT; at: number }>();

function pruneResults(): void {
  const now = Date.now();
  for (const [key, entry] of results) {
    if (now - entry.at > RESULT_TTL_MS) results.delete(key);
  }
  // Map conserve l'ordre d'insertion : les plus anciennes sortent d'abord.
  while (results.size > MAX_RESULTS) {
    const oldest = results.keys().next();
    if (oldest.done) break;
    results.delete(oldest.value);
  }
}

/**
 * Reporte le résultat d'un refresh sur le token de l'appelant courant.
 * On ne renvoie jamais l'objet mémorisé tel quel : l'appelant peut porter
 * d'autres champs (email, isStaff, sub…) qu'il faut préserver.
 */
function applyRefreshed(token: JWT, refreshed: JWT): JWT {
  return {
    ...token,
    accessToken: refreshed.accessToken,
    accessTokenExpires: refreshed.accessTokenExpires,
    refreshToken: refreshed.refreshToken,
    refreshTokenExpires: refreshed.refreshTokenExpires,
    error: refreshed.error,
  };
}

export async function refreshWithMutex(
  token: JWT,
  refreshFn: RefreshFn
): Promise<JWT> {
  const key = typeof token.refreshToken === "string" ? token.refreshToken : null;

  // Sans refresh token, rien à dédupliquer : l'appel échouera proprement.
  if (!key) return refreshFn(token);

  pruneResults();

  // Cas 2 : ce token a déjà été échangé récemment, on rejoue le résultat.
  const cached = results.get(key);
  if (cached) {
    console.log("[RefreshMutex] Token déjà échangé, réutilisation du résultat");
    return applyRefreshed(token, cached.jwt);
  }

  // Cas 1 : un échange est en cours pour ce token, on attend le même résultat.
  const pending = inFlight.get(key);
  if (pending) {
    console.log("[RefreshMutex] Refresh déjà en cours, attente du résultat...");
    return applyRefreshed(token, await pending);
  }

  console.log("[RefreshMutex] Démarrage d'un nouveau refresh");
  const promise = refreshFn(token)
    .then((refreshed) => {
      // On ne mémorise qu'un succès : mémoriser un échec condamnerait toutes
      // les requêtes suivantes pendant la durée du TTL.
      if (refreshed.accessToken && !refreshed.error) {
        results.set(key, { jwt: refreshed, at: Date.now() });
      }
      return refreshed;
    })
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    });

  inFlight.set(key, promise);

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
 * Réinitialise l'état (tests, ou après une déconnexion explicite).
 */
export function resetRefreshMutex(): void {
  inFlight.clear();
  results.clear();
}
