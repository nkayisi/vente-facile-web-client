/**
 * Lire un nombre TAPÉ À LA MAIN, au back-office.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ MIROIR DE `mobile/vf-marchand/src/data/nombres.ts`, TENU À LA MAIN.     │
 * │                                                                          │
 * │ Sa place est `@vente-facile/core`, où ce dépôt range ce que les deux     │
 * │ surfaces doivent appliquer à l'identique. L'y mettre demande de publier  │
 * │ un tag du paquet et de bumper les deux consommateurs : non fait ici.     │
 * │ Les cas de référence sont ceux du terminal, et ils sont exécutables      │
 * │ (`cd mobile/vf-marchand && pnpm jest nombres`).                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ Le web s'en tirait jusqu'ici avec `parseFloat(v.replace(",", "."))` parce
 * que ses champs sont des `<input type="number">`, où l'espace ne se tape pas.
 * Dès qu'un champ accepte du texte libre - et un prix facturé en accepte -
 * `parseFloat("12 500")` rend **DOUZE**, en silence.
 *
 * **Le MOTIF est rendu, pas la phrase** : la formulation appartient à l'écran
 * qui la montre. `phraseDeRefus` en donne une par défaut, pour les cas où
 * l'écran n'a rien de plus précis à dire.
 */

export type MotifRefus = "negatif" | "illisible";

export type LectureNombre =
  /** `valeur` est la valeur lue. Une saisie VIDE rend `ok` avec `valeur: null`. */
  | { ok: true; valeur: number | null }
  | { ok: false; motif: MotifRefus };

/** Espace fine, espace insécable et espace ordinaire : les trois séparateurs de milliers. */
const ESPACES = /[\s  ]/g;

export function lireNombre(saisie: string): LectureNombre {
  const brut = saisie.replace(ESPACES, "");
  if (brut === "") return { ok: true, valeur: null };
  if (brut.startsWith("-")) return { ok: false, motif: "negatif" };

  // Une seule virgule est remplacée : « 12,500,50 » reste illisible, et doit
  // le rester. En français la virgule est décimale, pas un séparateur de
  // milliers, et deviner laquelle des deux le marchand voulait écrirait un
  // montant faux qui a l'air juste.
  const normalise = brut.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalise)) return { ok: false, motif: "illisible" };

  const n = Number(normalise);
  if (!Number.isFinite(n)) return { ok: false, motif: "illisible" };
  return { ok: true, valeur: n };
}

export function phraseDeRefus(motif: MotifRefus): string {
  return motif === "negatif"
    ? "Ce nombre ne peut pas être négatif."
    : "Ce nombre n'est pas lisible.";
}

/**
 * Lit une saisie en EXIGEANT une valeur.
 *
 * Commodité pour les champs obligatoires : une saisie vide y est un refus, et
 * c'est l'appelant qui dit si le vide est permis. Les confondre ferait
 * enregistrer zéro là où personne n'a rien tapé - et zéro, sur une quantité,
 * est le constat d'un rayon vide.
 */
export function lireNombreRequis(
  saisie: string
): { ok: true; valeur: number } | { ok: false; phrase: string } {
  const lu = lireNombre(saisie);
  if (!lu.ok) return { ok: false, phrase: phraseDeRefus(lu.motif) };
  if (lu.valeur === null) return { ok: false, phrase: "Indiquez une valeur." };
  return { ok: true, valeur: lu.valeur };
}

/**
 * Le jour LOCAL, au format que les champs date et l'API attendent.
 *
 * ⚠ `new Date().toISOString().slice(0, 10)` donne le jour UTC : entre 23 h et
 * minuit à Kinshasa, il rend la VEILLE. C'est la dette de fuseau que le backend
 * a dû refermer sur une vingtaine de sites, et quatre pages du back-office
 * l'ont encore.
 */
export function jourISO(d: Date = new Date()): string {
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}
