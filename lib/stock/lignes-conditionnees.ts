/**
 * Ce qu'une ligne de transfert ou d'ajustement VAUT, et ce qui l'empêche de partir.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ MIROIR STRICT DE `mobile/vf-marchand/src/features/stock/                │
 * │ lignes-conditionnees.ts`, ET C'EST UN MIROIR TENU À LA MAIN.            │
 * │                                                                          │
 * │ Ces règles devraient vivre dans `@vente-facile/core`, comme              │
 * │ l'arithmétique qu'elles emploient : c'est là que le dépôt range ce que   │
 * │ les deux surfaces doivent appliquer À L'IDENTIQUE. Elles n'y sont pas    │
 * │ encore, parce que les y mettre demande de publier un tag du paquet, ce   │
 * │ qui n'est pas un geste à faire en passant.                               │
 * │                                                                          │
 * │ En attendant, ce fichier est une COPIE, et le frontend n'a aucun         │
 * │ lanceur de tests pour la garder honnête. Les cas de référence sont donc  │
 * │ ceux du terminal, et ils sont exécutables :                              │
 * │                                                                          │
 * │   cd mobile/vf-marchand && pnpm jest lignes-conditionnees                │
 * │                                                                          │
 * │ Toute modification ici doit être reportée là-bas, et inversement.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * **Aucune conversion ne fait autorité ici.** `toBaseQuantity` ne sert qu'à
 * ÉCRIRE le récapitulatif que l'opérateur relit avant de valider : c'est le
 * serveur qui convertit (`PackagingService.to_base`), et une seconde
 * arithmétique du conditionnement finirait par diverger de la sienne.
 */
import {
  formatPackagedDifference,
  formatPackagedSplit,
  pluralizeUnit,
  splitPackaged,
  toBaseQuantity,
  type Packaging,
} from "@vente-facile/core";

/** L'état des deux champs de quantité, déjà LU. */
export interface SaisieQuantite {
  /** `null` pour un article vendu au détail seul : un seul champ à l'écran. */
  conditionnement: Packaging | null;
  contenants: number | null;
  /** Aussi la quantité SIMPLE d'un article sans conditionnement. */
  vrac: number | null;
}

/** Les deux compteurs d'un rayon, LUS sur la ligne de stock et jamais redivisés. */
export interface PartageStock {
  contenants: number;
  vrac: number;
  /** Total en unité de détail. C'est lui qui fait foi côté serveur. */
  total: number;
}

export interface ErreursQuantite {
  contenants?: string;
  vrac?: string;
}

/**
 * Le mot du canal, au pluriel et INVARIABLE.
 *
 * « Nombre de AMPOULES » ne s'accorde pas et « de » s'élide devant une
 * voyelle ; le GENRE d'un nom d'unité n'est pas dérivable sans lexique, et le
 * nom vient du marchand. « Quantité en X » marche pour les deux genres et ne
 * s'élide jamais. Le back-office écrivait « Nombre de {contenants} », qui porte
 * la même faute que celle corrigée sur le terminal au lot 7.
 */
export function motCanal(mot: string): string {
  return pluralizeUnit(mot, 2);
}

/** « Quantité en CASIERS », « Quantité en BOUTEILLES ». */
export function libelleCanal(mot: string): string {
  return `Quantité en ${motCanal(mot)}`;
}

/** « 1 CASIER = 12 BOUTEILLES ». Le rappel qui évite la multiplication de tête. */
export function rappelConditionnement(cond: Packaging): string {
  return `1 ${pluralizeUnit(cond.packageWord, 1)} = ${cond.factor} ${pluralizeUnit(
    cond.retailWord,
    cond.factor
  )}`;
}

/**
 * Le total en unité de détail, POUR L'AFFICHAGE seulement.
 *
 * Il n'est jamais envoyé quand un conditionnement existe : c'est la saisie qui
 * part, et le serveur qui convertit.
 */
export function totalSaisi(s: SaisieQuantite): number {
  const contenants = s.contenants ?? 0;
  const vrac = s.vrac ?? 0;
  if (!s.conditionnement) return vrac;
  return toBaseQuantity(s.conditionnement, contenants, vrac);
}

/**
 * Ce qui empêche d'ajouter la ligne, et la phrase à écrire sous le champ fautif.
 *
 * `zeroAccepte` distingue les deux gestes. Compter un rayon VIDE est le
 * comptage le plus important qui soit : « zéro face à un théorique de dix » est
 * précisément l'écart qu'un ajustement existe pour écrire. Transférer zéro ne
 * veut rien dire, et le serveur le refuse (`if not quantity_requested`).
 */
export function verifierQuantite(
  s: SaisieQuantite,
  { zeroAccepte = false }: { zeroAccepte?: boolean } = {}
): ErreursQuantite {
  const cond = s.conditionnement;
  const contenants = s.contenants ?? 0;
  const vrac = s.vrac ?? 0;

  if (zeroAccepte) {
    // Ce qui est refusé est la saisie VIDE, jamais le zéro : les deux champs
    // laissés blancs ne disent pas « rien en rayon », ils ne disent rien.
    const rienDeTape = s.contenants == null && s.vrac == null;
    if (!rienDeTape) return {};
    const phrase = "Indiquez ce que vous avez compté, même si c'est zéro.";
    return cond ? { contenants: phrase } : { vrac: phrase };
  }

  if (!cond) {
    return vrac > 0 ? {} : { vrac: "Indiquez une quantité." };
  }

  // Vendu en gros SEUL : le canal de détail n'existe pas à l'écran, et un
  // contenant ne s'y ouvre jamais. Le serveur refuse d'ailleurs tout vrac.
  if (cond.packageOnly) {
    return contenants > 0
      ? {}
      : { contenants: `Indiquez une quantité en ${motCanal(cond.packageWord)}.` };
  }

  if (contenants <= 0 && vrac <= 0) {
    return {
      contenants: `Indiquez une quantité en ${motCanal(
        cond.packageWord
      )} ou en ${motCanal(cond.retailWord)}.`,
    };
  }
  return {};
}

/**
 * « Vous transférez 2 CASIERS + 5 BOUTEILLES = 29 BOUTEILLES. »
 *
 * C'est la seule ligne du formulaire qui prouve à l'opérateur que l'écran a
 * compris ce qu'il a tapé. Sans elle, il ne découvre le total qu'une fois la
 * pièce enregistrée, quand elle n'est plus modifiable.
 */
export function resumeConversion(s: SaisieQuantite, verbe: string): string | null {
  const cond = s.conditionnement;
  if (!cond) return null;

  const contenants = s.contenants ?? 0;
  const vrac = s.vrac ?? 0;
  if (contenants <= 0 && vrac <= 0) return null;

  const morceaux: string[] = [];
  if (contenants > 0) {
    morceaux.push(`${contenants} ${pluralizeUnit(cond.packageWord, contenants)}`);
  }
  if (vrac > 0) morceaux.push(`${vrac} ${pluralizeUnit(cond.retailWord, vrac)}`);

  const total = toBaseQuantity(cond, contenants, vrac);
  return `Vous ${verbe} ${morceaux.join(" + ")} = ${total} ${pluralizeUnit(
    cond.retailWord,
    total
  )}.`;
}

/**
 * Ce qu'un rayon porte, dans les mots du marchand.
 *
 * Le partage est LU, jamais redécoupé : repasser par une division du total
 * réécrirait « 3 casiers + 27 bouteilles » en « 4 casiers + 3 bouteilles ».
 */
export function afficherPartage(cond: Packaging | null, p: PartageStock): string {
  if (!cond) return String(p.total);
  return formatPackagedSplit(cond, p.contenants, p.vrac);
}

/**
 * Le dépassement du disponible, EN AVERTISSEMENT et jamais en refus.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ON AVERTIT, ON NE REFUSE PAS - ET C'EST L'INVERSE DU COMPTOIR.          │
 * │                                                                          │
 * │ Une vente imprime son ticket sur-le-champ : le comptoir doit donc        │
 * │ refuser ce que le serveur refusera. Un transfert, lui, naît en BROUILLON │
 * │ et ne sort le stock qu'à l'EXPÉDITION, un geste distinct qui peut avoir  │
 * │ lieu le lendemain - le serveur ne contrôle d'ailleurs le disponible qu'à │
 * │ ce moment-là (`assert_sealed_available` dans `ship_transfer`), jamais à  │
 * │ la création. Refuser ici interdirait de préparer un transfert pour une   │
 * │ livraison attendue dans l'après-midi, ce qui est le cas ordinaire.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Le contrôle est PAR CANAL, comme celui du serveur : demander 5 casiers sur
 * un rayon qui en porte 3 scellés et 90 bouteilles isolées sera refusé à
 * l'expédition, alors même que le total suffit largement.
 */
export function alerteDisponible(
  s: SaisieQuantite,
  dispo: PartageStock | null,
  { negatifAutorise = false }: { negatifAutorise?: boolean } = {}
): string | null {
  // Le dépôt tolère les soldes négatifs : le serveur n'oppose RIEN à
  // l'expédition (`assert_sealed_available` sort en tête sur ce drapeau).
  // Avertir d'un refus qui n'aura pas lieu apprend à ne plus lire l'écran.
  if (negatifAutorise) return null;
  if (!dispo) return null;

  const cond = s.conditionnement;
  const contenants = s.contenants ?? 0;
  const vrac = s.vrac ?? 0;

  if (!cond) {
    if (vrac > dispo.total) {
      return `Il n'y a que ${dispo.total} en rayon. L'expédition sera refusée si le stock n'a pas bougé d'ici là.`;
    }
    return null;
  }

  const manques: string[] = [];
  if (contenants > dispo.contenants) {
    manques.push(
      `${dispo.contenants} ${pluralizeUnit(cond.packageWord, dispo.contenants)} en scellé`
    );
  }
  // Servir le détail peut exiger d'ouvrir un contenant : le serveur le fait
  // (`ensure_loose_available`), donc le vrac isolé ne borne rien à lui seul.
  // C'est le TOTAL qui borne la part au détail, une fois les scellés demandés
  // mis de côté.
  const resteApresScelles = dispo.total - contenants * cond.factor;
  if (vrac > resteApresScelles) {
    const reste = Math.max(0, resteApresScelles);
    manques.push(`${reste} ${pluralizeUnit(cond.retailWord, reste)} au détail`);
  }
  if (manques.length === 0) return null;

  return `Il ne reste que ${manques.join(" et ")}. L'expédition sera refusée si le stock n'a pas bougé d'ici là.`;
}

/**
 * L'écart d'un comptage, VENTILÉ PAR CANAL : « -2 casiers, +5 bouteilles ».
 *
 * Un manquant de scellés et un surplus d'unités isolées se compensent dans le
 * total et y disparaissent ; ventilés, chacun désigne sa cause. Miroir strict
 * de `_difference_display` du serveur, y compris son `split` de normalisation
 * de l'attendu.
 */
export function ecartDuComptage(
  cond: Packaging | null,
  attendu: PartageStock,
  compte: SaisieQuantite
): { texte: string; signe: -1 | 0 | 1; total: number } {
  const total = totalSaisi(compte) - attendu.total;
  const signe: -1 | 0 | 1 = total < 0 ? -1 : total > 0 ? 1 : 0;

  if (!cond) {
    return { texte: `${total > 0 ? "+" : ""}${total}`, signe, total };
  }

  const attenduSplit = splitPackaged(attendu.total, attendu.vrac, cond.factor);
  const texte = formatPackagedDifference(
    cond,
    (compte.contenants ?? 0) - attenduSplit.packages,
    (compte.vrac ?? 0) - attenduSplit.loose
  );
  return { texte, signe, total };
}

/**
 * Lire une quantité TAPÉE À LA MAIN.
 *
 * ⚠ `parseInt` était employé dans les deux formulaires : il TRONQUE. Une
 * quantité de « 1,5 » y devenait 1, et « 12.750 » devenait 12, en silence -
 * alors que les quantités portent TROIS décimales dans tout ce projet. C'est
 * une perte de données qu'aucun message ne signale.
 *
 * `undefined` pour une saisie vide, qui ne veut pas dire zéro ; `null` pour une
 * saisie illisible, dont l'appelant décide de la phrase.
 */
export function lireQuantite(brut: string): number | null | undefined {
  const t = brut.replace(/[\s  ]/g, "").replace(",", ".");
  if (t === "") return undefined;
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
