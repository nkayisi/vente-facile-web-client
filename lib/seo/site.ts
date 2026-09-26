/**
 * L'URL publique du site, en UN SEUL endroit.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN BUILD SANS `NEXT_PUBLIC_APP_URL` PUBLIERAIT DES CANONICALS VERS       │
 * │ LOCALHOST, EN SILENCE, SUR TOUTES LES PAGES À LA FOIS.                   │
 * │                                                                          │
 * │ `metadataBase` retombait sur `http://localhost:3005`. Rien ne lève, la   │
 * │ page s'affiche, et Google reçoit une URL canonique qu'il ne peut pas     │
 * │ atteindre : le site entier devient inindexable et personne ne le voit.   │
 * │ On échoue donc AU BUILD plutôt que de le découvrir dans Search Console.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * C'est le précédent du dépôt : `lib/api/axios.ts` lève déjà si
 * `NEXT_PUBLIC_API_URL` manque en production, et le backend lève
 * `ImproperlyConfigured` si `SECRET_KEY` reste à sa valeur par défaut.
 *
 * ⚠ La variable EST posée en production (le canonical servi le prouve) et le
 * Dockerfile la passe en `ARG`/`ENV` au build. Le fail-loud ne casse donc rien
 * d'existant ; il ferme un trou.
 */

/** Le repli de DÉVELOPPEMENT, et seulement lui. Le port du conteneur. */
const REPLI_DEV = "http://localhost:3005";

function resoudreUrlSite(): string {
  const brut = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (brut) {
    // La barre finale est retirée ICI, une fois pour tous les consommateurs :
    // `metadataBase` la recolle aux chemins, et « .../api/v1/ » + « /sync » a
    // déjà donné « //sync » sur le terminal. Le même piège, transposé.
    return brut.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL est absente en production. Sans elle, les URL " +
        "canoniques, le plan de site et les données structurées pointeraient " +
        "vers localhost, et le site ne serait pas indexable. Posez-la au build.",
    );
  }

  return REPLI_DEV;
}

/** `https://vente-facile.net`, sans barre finale. */
export const URL_SITE = resoudreUrlSite();

/**
 * L'hôte canonique, `www` retiré s'il était là.
 *
 * ⚠ On le DÉRIVE au lieu de le coder en dur : si quelqu'un pose un jour
 * `NEXT_PUBLIC_APP_URL=https://www.vente-facile.net`, la redirection de
 * `next.config.ts` construirait sinon `www.www.vente-facile.net` et enverrait
 * tout le trafic vers un hôte qui n'existe pas.
 */
export const HOTE_CANONIQUE = new URL(URL_SITE).host.replace(/^www\./, "");

/** L'hôte à faire rediriger vers l'apex. */
export const HOTE_WWW = `www.${HOTE_CANONIQUE}`;

/** Construit une URL absolue à partir d'un chemin du registre. */
export function urlAbsolue(chemin: string): string {
  return chemin === "/" ? URL_SITE : `${URL_SITE}${chemin}`;
}
