/**
 * Le PÉRIMÈTRE d'un approvisionnement de masse : ses libellés, et son URL.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LE PÉRIMÈTRE VOYAGE EN PARAMÈTRES D'URL, PAS EN ÉTAT REACT.             │
 * │                                                                          │
 * │ La modale le compose, la feuille le lit. Le passer par un état partagé   │
 * │ rendrait la feuille non rechargeable : un F5 sur une saisie de quarante  │
 * │ lignes la ramènerait à un écran vide sans périmètre, et le bouton Retour │
 * │ du navigateur ne ramènerait nulle part.                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ CE MODULE NE CONNAÎT NI REACT NI LE RÉSEAU. Une lecture d'URL fausse ne
 * lève rien : elle prépare simplement la feuille du mauvais entrepôt, et le
 * magasinier ne s'en aperçoit qu'en comparant au rayon. C'est pourquoi la
 * décision est ici, éprouvable sans monter un écran.
 */
import type { MovementType, SupplyScope } from "@/actions/stock.actions";

/** Une entrée choisie : son identifiant, et le mot que le marchand lit. */
export interface OptionPerimetre {
  value: string;
  label: string;
}

export interface PerimetreAppro {
  /** Obligatoire côté serveur : une entrée de stock entre quelque part. */
  entrepot: string;
  type: MovementType;
  portee: SupplyScope;
  categories: OptionPerimetre[];
  articles: OptionPerimetre[];
  recherche: string;
}

/**
 * Les types d'ENTRÉE, seuls recevables.
 *
 * ⚠ Ce n'est pas un panier d'écritures hétérogènes, c'est une LIVRAISON : le
 * serveur refuse toute sortie (`STOCK_IN_MOVEMENT_TYPES`).
 */
export const TYPES_ENTREE: { valeur: MovementType; libelle: string }[] = [
  { valeur: "purchase", libelle: "Achat" },
  { valeur: "return_in", libelle: "Retour client" },
  { valeur: "adjustment_in", libelle: "Ajustement positif" },
  { valeur: "transfer_in", libelle: "Transfert entrant" },
  { valeur: "production_in", libelle: "Production" },
  { valeur: "initial", libelle: "Stock initial" },
];

export const PORTEES: { valeur: SupplyScope; libelle: string; aide: string }[] = [
  {
    valeur: "low",
    libelle: "Sous le seuil",
    aide: "Ce qu'il faut racheter en priorité.",
  },
  {
    valeur: "category",
    libelle: "Par catégorie",
    aide: "Toute la catégorie, sous-catégories comprises.",
  },
  {
    valeur: "product",
    libelle: "Articles choisis",
    aide: "Une liste que vous composez.",
  },
  {
    valeur: "all",
    libelle: "Tout le catalogue",
    aide: "Tous les articles suivis en stock.",
  },
];

export const PERIMETRE_VIDE: PerimetreAppro = {
  entrepot: "",
  type: "purchase",
  portee: "low",
  categories: [],
  articles: [],
  recherche: "",
};

export function libelleType(type: MovementType): string {
  return TYPES_ENTREE.find((t) => t.valeur === type)?.libelle ?? type;
}

export function libellePortee(portee: SupplyScope): string {
  return PORTEES.find((p) => p.valeur === portee)?.libelle ?? portee;
}

export function aidePortee(portee: SupplyScope): string {
  return PORTEES.find((p) => p.valeur === portee)?.aide ?? "";
}

/**
 * Ce qui manque au périmètre pour être préparable, dit en une phrase.
 *
 * `null` quand il est complet. Le serveur oppose les mêmes trois règles ; les
 * dire ici évite un aller-retour pour un champ vide, et c'est le seul motif de
 * cette duplication.
 */
export function motifIncomplet(p: PerimetreAppro): string | null {
  if (!p.entrepot) {
    return "Choisissez l'entrepôt : une entrée de stock entre quelque part.";
  }
  if (p.portee === "category" && p.categories.length === 0) {
    return "Choisissez au moins une catégorie, sinon la feuille serait vide.";
  }
  if (p.portee === "product" && p.articles.length === 0) {
    return "Choisissez au moins un article, sinon la feuille serait vide.";
  }
  return null;
}

/**
 * Le périmètre, en paramètres d'URL.
 *
 * ⚠ SEULS LES IDENTIFIANTS VOYAGENT, jamais les libellés : un nom de catégorie
 * porte des virgules et des accents, et c'est le SERVEUR qui renvoie les noms
 * résolus avec la feuille (`selection`). Les recopier ici donnerait deux
 * sources pour le même mot.
 */
export function versParams(p: PerimetreAppro): URLSearchParams {
  const params = new URLSearchParams();
  if (p.entrepot) params.set("warehouse", p.entrepot);
  params.set("type", p.type);
  params.set("scope", p.portee);
  if (p.portee === "category" && p.categories.length > 0) {
    params.set("categories", p.categories.map((c) => c.value).join(","));
  }
  if (p.portee === "product" && p.articles.length > 0) {
    params.set("products", p.articles.map((a) => a.value).join(","));
  }
  if (p.recherche.trim()) params.set("search", p.recherche.trim());
  return params;
}

/** Les identifiants d'une liste séparée par des virgules, sans trou ni doublon. */
function identifiants(brut: string | null): string[] {
  if (!brut) return [];
  const vus = new Set<string>();
  for (const morceau of brut.split(",")) {
    const id = morceau.trim();
    if (id) vus.add(id);
  }
  return [...vus];
}

/**
 * Le périmètre lu d'une URL.
 *
 * ⚠ TOUTE VALEUR INCONNUE RETOMBE SUR LE DÉFAUT, elle ne lève pas : une URL
 * tapée à la main, un lien d'une version antérieure ou un copier-coller tronqué
 * ne doivent pas rendre un écran blanc. Et `aucunParametre` dit à l'appelant
 * qu'il n'y a rien à préparer - c'est lui qui ouvre alors la modale, plutôt que
 * d'afficher une feuille vide sans dire pourquoi.
 */
export function depuisParams(sp: URLSearchParams): {
  perimetre: PerimetreAppro;
  aucunParametre: boolean;
} {
  const entrepot = sp.get("warehouse") ?? "";
  const typeBrut = sp.get("type") ?? "";
  const porteeBrute = sp.get("scope") ?? "";

  const type = TYPES_ENTREE.some((t) => t.valeur === typeBrut)
    ? (typeBrut as MovementType)
    : PERIMETRE_VIDE.type;
  const portee = PORTEES.some((p) => p.valeur === porteeBrute)
    ? (porteeBrute as SupplyScope)
    : PERIMETRE_VIDE.portee;

  // Les libellés sont inconnus tant que le serveur n'a pas répondu : on pose
  // l'identifiant en attendant, et `avecLesNoms` le remplace à l'arrivée de la
  // feuille. Jamais « 2 catégories » : une puce qu'on ne peut pas nommer ne se
  // retire pas de façon sûre.
  const enOptions = (ids: string[]) => ids.map((value) => ({ value, label: value }));

  return {
    perimetre: {
      entrepot,
      type,
      portee,
      categories: enOptions(identifiants(sp.get("categories"))),
      articles: enOptions(identifiants(sp.get("products"))),
      recherche: sp.get("search") ?? "",
    },
    // ⚠ L'ENTREPÔT SEUL DÉCIDE : lui absent, il n'y a rien à préparer, quels
    //   que soient les autres paramètres.
    aucunParametre: !entrepot,
  };
}

/**
 * Les libellés résolus par le serveur, posés sur les puces.
 *
 * Une entrée que le serveur ne nomme pas garde ce qu'elle avait : elle a pu
 * être supprimée entre le partage du lien et son ouverture, et la faire
 * disparaître du périmètre affiché ferait croire à une feuille plus large
 * qu'elle n'est.
 */
export function avecLesNoms(
  p: PerimetreAppro,
  noms: { categories?: OptionPerimetre[]; articles?: OptionPerimetre[] }
): PerimetreAppro {
  const resoudre = (
    actuelles: OptionPerimetre[],
    connues: OptionPerimetre[] | undefined
  ) => {
    if (!connues || connues.length === 0) return actuelles;
    const table = new Map(connues.map((o) => [o.value, o.label]));
    return actuelles.map((o) => ({ ...o, label: table.get(o.value) ?? o.label }));
  };

  return {
    ...p,
    categories: resoudre(p.categories, noms.categories),
    articles: resoudre(p.articles, noms.articles),
  };
}

/** Le périmètre en toutes lettres, pour l'en-tête de la feuille. */
export function resumePerimetre(
  p: PerimetreAppro,
  nomEntrepot: string | null
): string {
  const morceaux = [
    nomEntrepot || null,
    libelleType(p.type),
    libellePortee(p.portee),
  ].filter(Boolean) as string[];

  if (p.portee === "category" && p.categories.length > 0) {
    morceaux.push(p.categories.map((c) => c.label).join(", "));
  }
  if (p.portee === "product" && p.articles.length > 0) {
    morceaux.push(`${p.articles.length} article(s)`);
  }
  if (p.recherche.trim()) morceaux.push(`« ${p.recherche.trim()} »`);

  return morceaux.join(" · ");
}
