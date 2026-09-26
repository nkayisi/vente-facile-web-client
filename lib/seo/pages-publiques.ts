/**
 * LE REGISTRE DES PAGES PUBLIQUES. Une page indexable qui n'est pas ici n'existe
 * pour personne.
 *
 * Quatre consommateurs, et c'est tout l'intérêt d'un registre :
 *   - `app/sitemap.ts`            : les URL déclarées à Google
 *   - `middleware.ts`             : `PUBLIC_ROUTES`, voir l'encadré ci-dessous
 *   - `lib/seo/metadonnees.ts`    : le titre, la description et le CANONICAL
 *   - `scripts/check-seo.mjs`     : le garde-fou
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ POURQUOI LE MIDDLEWARE EN DÉPEND, ET CE N'EST PAS DU CONFORT.            │
 * │                                                                          │
 * │ `middleware.ts` compare le chemin à `PUBLIC_ROUTES` en ÉGALITÉ EXACTE.   │
 * │ Sa règle « session expirée » renvoie vers /auth/login toute route qui    │
 * │ n'y figure pas : un visiteur porteur d'un cookie périmé qui ouvrirait    │
 * │ /tarifs se ferait éjecter d'une page PUBLIQUE. Une liste écrite à la     │
 * │ main aurait oublié la sixième page, et le défaut ne se voit que sur un   │
 * │ cookie périmé, donc jamais pendant le développement.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export interface PagePublique {
  /** Le chemin servi, avec sa barre de tête. C'est la clé du registre. */
  chemin: string;

  /**
   * Le `<title>`. Il passe par le gabarit « %s | Vente Facile » du layout
   * racine, SAUF si `titreAbsolu` est vrai.
   */
  titre: string;

  /**
   * ⚠ Réservé à l'accueil, dont le titre porte DÉJÀ la marque. Sans ce
   * drapeau, l'onglet et chaque résultat de recherche sortiraient
   * « … qui n'attend pas le réseau | Vente Facile », la marque deux fois en
   * soixante-six caractères.
   */
  titreAbsolu?: boolean;

  description: string;

  /** Libellé court, pour le pied de page et le fil d'Ariane. */
  libelle: string;

  /** 1 pour l'accueil, 0,9 pour ce qui convertit, 0,3 pour le légal. */
  priorite: number;

  frequence: "weekly" | "monthly" | "yearly";

  /**
   * ⚠ LA VRAIE DATE DU DERNIER CHANGEMENT DE CONTENU, écrite à la main, et
   * surtout PAS la date du build. Servir la date de déploiement ferait paraître
   * les sept pages modifiées à chaque mise en production, y compris celles qui
   * n'ont pas bougé : Google apprend alors à ne plus croire le signal, et on
   * perd le seul moyen de lui dire qu'une page a réellement changé.
   */
  misAJourLe: `${number}-${number}-${number}`;
}

export const PAGES_PUBLIQUES: readonly PagePublique[] = [
  {
    chemin: "/",
    titre: "Vente Facile · La caisse qui n'attend pas le réseau",
    titreAbsolu: true,
    description:
      "Caisse, stock et crédit client pour les commerces de la RDC. Vendez en francs et en dollars, comptez en casiers et en bouteilles, imprimez le ticket même hors ligne.",
    libelle: "Accueil",
    priorite: 1,
    frequence: "monthly",
    misAJourLe: "2026-09-26",
  },
  {
    chemin: "/fonctionnalites",
    titre: "Fonctionnalités : caisse, stock et crédit client",
    description:
      "Point de vente, stock multi-dépôts, inventaire, crédit client, livre de caisse, devis et retours, rapports, équipe. Huit modules dans un seul logiciel, et chacun est un écran qui existe.",
    libelle: "Fonctionnalités",
    priorite: 0.9,
    frequence: "monthly",
    misAJourLe: "2026-09-26",
  },
  {
    chemin: "/caisse-hors-ligne",
    titre: "Une caisse qui marche sans internet",
    description:
      "Comment Vente Facile encaisse et imprime sans réseau : le numéro du ticket est définitif dès l'impression, la synchronisation rend un verdict par opération, et la seule limite est écrite noir sur blanc.",
    libelle: "La caisse hors ligne",
    priorite: 0.9,
    frequence: "monthly",
    misAJourLe: "2026-09-26",
  },
  {
    chemin: "/tarifs",
    titre: "Tarifs et essai de quatorze jours",
    description:
      "Le prix de Vente Facile, plan par plan. Quatorze jours d'essai sans carte bancaire, puis paiement par Mobile Money. Ce qui distingue les plans, ce sont les volumes, jamais les fonctions.",
    libelle: "Tarifs",
    priorite: 0.9,
    frequence: "monthly",
    misAJourLe: "2026-09-26",
  },
  {
    chemin: "/contact",
    titre: "Nous joindre",
    description:
      "Joindre l'équipe de Vente Facile à Kinshasa : téléphone, WhatsApp, courriel et adresse. Pour une question, une démonstration, ou de l'aide sur une caisse déjà en service.",
    libelle: "Contact",
    priorite: 0.5,
    frequence: "yearly",
    misAJourLe: "2026-09-26",
  },
  {
    chemin: "/mentions-legales",
    titre: "Mentions légales",
    description:
      "Éditeur, hébergeur et conditions de mise à disposition du site Vente Facile.",
    libelle: "Mentions légales",
    priorite: 0.3,
    frequence: "yearly",
    misAJourLe: "2026-09-26",
  },
  {
    chemin: "/politique-de-confidentialite",
    titre: "Politique de confidentialité",
    description:
      "Quelles données Vente Facile collecte, pourquoi, combien de temps elles sont conservées, à qui elles sont confiées, et comment exercer vos droits.",
    libelle: "Confidentialité",
    priorite: 0.3,
    frequence: "yearly",
    misAJourLe: "2026-09-26",
  },
] as const;

/** Les chemins seuls. Consommé par `middleware.ts`. */
export const CHEMINS_PUBLICS: readonly string[] = PAGES_PUBLIQUES.map(
  (page) => page.chemin,
);

/**
 * Rend l'entrée du registre, ou lève.
 *
 * ⚠ ELLE LÈVE, ET C'EST VOULU. Un chemin absent est une faute de frappe dans
 * un appel de page : rendre `undefined` ferait publier une page sans titre,
 * sans description et SANS CANONICAL, c'est-à-dire une page que Google
 * n'indexerait jamais, sans qu'aucune erreur ne le dise.
 */
export function pagePubliqueDe(chemin: string): PagePublique {
  const page = PAGES_PUBLIQUES.find((entree) => entree.chemin === chemin);

  if (!page) {
    throw new Error(
      `Le chemin « ${chemin} » n'est pas au registre des pages publiques. ` +
        `Ajoutez-le dans lib/seo/pages-publiques.ts : sans lui, la page n'aurait ` +
        `ni canonical, ni entrée au plan de site, et le middleware la rejetterait.`,
    );
  }

  return page;
}
