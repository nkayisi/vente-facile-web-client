import { auth } from "@/lib/auth";

/**
 * L'état de session que l'en-tête public attend.
 *
 * ⚠ RÉSOLU CÔTÉ SERVEUR, sur TOUTES les pages publiques, et c'est délibéré.
 * `SiteHeader` documente pourquoi (`components/marketing/site-header.tsx`) :
 * il appelait `useSession()`, affichait « Connexion » puis basculait sur
 * « Mon compte » après hydratation, un clignotement sur le premier élément que
 * le visiteur regarde. Laisser les sous-pages lire la session côté client
 * rouvrirait ce défaut sur six pages d'un coup.
 *
 * ⚠ CONTREPARTIE ASSUMÉE : ces pages sont donc rendues à la requête et ne
 * peuvent pas être mises en cache. C'est le même arbitrage que l'accueil, pris
 * en connaissance de cause. Y revenir demanderait `cacheComponents`, qui
 * s'applique à toute l'application.
 */
export async function etatEntete() {
  const session = await auth();

  return {
    isAuthenticated: Boolean(session?.user),
    isStaff: Boolean(session?.isStaff),
  };
}
