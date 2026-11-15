/**
 * Les entrepôts qu'un écran PROPOSE, selon ce qu'on va en faire.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LIRE N'EST PAS AGIR.                                                    │
 * │                                                                          │
 * │ Un filtre d'historique propose ce qu'on peut LIRE : les entrepôts        │
 * │ désactivés compris, pour relire leur passé (badge « inactif »). Une      │
 * │ saisie (vendre, transférer, ajuster, ouvrir une caisse) propose ce où    │
 * │ l'on peut AGIR : ses entrepôts affectés, actifs. Un membre à qui le      │
 * │ propriétaire a ouvert la consultation de tous LIT partout mais n'agit    │
 * │ que chez lui : lui proposer un entrepôt lisible dans une saisie ferait   │
 * │ répondre « consultation seule » au serveur, après la saisie.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LA RÈGLE VIT DANS `@vente-facile/core` (`entrepotsActionnables`), PAS ICI.
 * Ce module ne fait que l'appliquer à une liste et fabriquer les libellés.
 *
 * ⚠ EN LECTURE, ON NE RE-FILTRE PAS : le serveur borne déjà la liste au
 * périmètre de lecture, et c'est lui l'autorité. Re-filtrer côté client sur des
 * droits lus il y a une minute cacherait l'entrepôt qu'on vient d'affecter,
 * c'est-à-dire exactement « l'entrepôt qui ne s'affiche pas ».
 */
import { entrepotsActionnables, type MembrePerimetre } from "@vente-facile/core";

export type UsageEntrepot = "action" | "lecture";

/** Ce qu'il faut d'un entrepôt pour le proposer. */
export interface EntrepotProposable {
  id: string;
  name: string;
  code?: string;
  /** Absent : actif (un serveur antérieur n'envoie pas toujours le champ). */
  is_active?: boolean;
}

/** Une entrée d'annuaire : l'entrepôt réduit à son nom. */
export interface EntreeAnnuaire {
  id: string;
  name: string;
  is_active: boolean;
}

export const estActif = (e: { is_active?: boolean }): boolean => e.is_active !== false;

/** Le libellé d'un entrepôt dans un sélecteur. */
export function libelleEntrepot(e: EntrepotProposable, usage: UsageEntrepot): string {
  return usage === "lecture" && !estActif(e) ? `${e.name} (inactif)` : e.name;
}

/**
 * Les entrepôts à proposer pour cet usage.
 *
 * Sans membre connu (droits en cours de chargement), l'action retombe sur les
 * seuls actifs : le serveur reste juge, et une liste vide ferait croire que le
 * membre n'a aucun entrepôt.
 */
export function entrepotsPourUsage<T extends EntrepotProposable>(
  membre: MembrePerimetre | null,
  tous: readonly T[],
  usage: UsageEntrepot,
): T[] {
  if (usage === "lecture") return [...tous];
  if (!membre || membre.role === null) return tous.filter(estActif);
  return entrepotsActionnables(membre, tous);
}

/** Minuscules, sans accents : « Entrepôt » se trouve en tapant « entrepot ». */
function plat(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Filtre local par terme, sur le nom et le code. */
export function filtrerParTerme<T extends EntrepotProposable>(liste: readonly T[], terme: string): T[] {
  const t = plat(terme.trim());
  if (!t) return [...liste];
  return liste.filter((e) => plat(e.name).includes(t) || plat(e.code ?? "").includes(t));
}

/** Les options `{value, label}` d'un sélecteur d'entrepôts. */
export function optionsEntrepots(
  tous: readonly EntrepotProposable[],
  usage: UsageEntrepot,
  membre: MembrePerimetre | null,
  terme = "",
): { value: string; label: string }[] {
  return filtrerParTerme(entrepotsPourUsage(membre, tous, usage), terme).map((e) => ({
    value: e.id,
    label: libelleEntrepot(e, usage),
  }));
}

/** Les actifs d'abord, puis par nom : l'ordre de l'annuaire du serveur. */
export function trierAnnuaire<T extends { name: string; is_active?: boolean }>(liste: readonly T[]): T[] {
  return [...liste].sort((a, b) => {
    const actifs = Number(estActif(b)) - Number(estActif(a));
    return actifs !== 0 ? actifs : a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  });
}

/** L'annuaire reconstitué depuis une liste de lecture (serveur antérieur). */
export function annuaireDepuisListe(liste: readonly EntrepotProposable[]): EntreeAnnuaire[] {
  return trierAnnuaire(
    liste.map((e) => ({ id: e.id, name: e.name, is_active: estActif(e) })),
  );
}

/**
 * Les destinations possibles d'un transfert : tout entrepôt ACTIF de
 * l'établissement, sauf la source. Un entrepôt désactivé ne reçoit rien.
 */
export function destinationsDeTransfert(
  annuaire: readonly EntreeAnnuaire[],
  sourceId: string | null | undefined,
): EntreeAnnuaire[] {
  return trierAnnuaire(annuaire.filter((e) => estActif(e) && e.id !== sourceId));
}

/** Les champs qu'un gérant peut modifier sur SES entrepôts. */
export const CHAMPS_ENTREPOT_DU_GERANT = ["name", "address"] as const;

/** Les champs que le propriétaire peut modifier. */
export const CHAMPS_ENTREPOT_DU_PROPRIETAIRE = [
  "name",
  "address",
  "code",
  "is_default",
  "is_active",
] as const;

/**
 * Le membre peut-il modifier CET entrepôt ?
 *
 * Le propriétaire, partout. Un membre qui a `warehouses.edit`, sur SES
 * entrepôts affectés seulement : la consultation de tous ne lui ouvre que la
 * lecture.
 */
export function peutModifierEntrepot(
  membre: MembrePerimetre,
  aLaPermission: boolean,
  entrepotId: string,
): boolean {
  if (membre.role === "owner") return true;
  if (!aLaPermission) return false;
  return membre.affectes.some((e) => e.id === entrepotId);
}

/**
 * Ce qui a CHANGÉ, borné aux champs autorisés.
 *
 * ⚠ ON N'ENVOIE QUE LA DIFFÉRENCE. Un formulaire qui renvoie tout ce qu'il a lu
 * ferait partir `is_default` inchangé sous le nom d'un gérant, et le serveur le
 * refuse comme une modification réservée au propriétaire.
 */
export function champsModifies<T extends Record<string, unknown>>(
  avant: T,
  apres: T,
  autorises: readonly (keyof T)[],
): Partial<T> {
  const diff: Partial<T> = {};
  for (const cle of autorises) {
    const a = avant[cle] ?? "";
    const b = apres[cle] ?? "";
    if (a !== b) diff[cle] = apres[cle];
  }
  return diff;
}

/**
 * Le membre peut-il AGIR dans cet entrepôt ? Le propriétaire partout ; un autre
 * dans ses affectés actifs. (Un entrepôt désactivé se refuse au serveur, même
 * au propriétaire : l'objet d'une pièce ne dit pas toujours s'il l'est.)
 */
export function agitDans(membre: MembrePerimetre | null, entrepotId: string | null | undefined): boolean {
  if (!membre || !entrepotId) return false;
  if (membre.role === "owner") return true;
  return membre.affectes.some((e) => e.id === entrepotId && estActif(e));
}

/**
 * Les gestes d'un transfert, PAR CÔTÉ : approuver, expédier et annuler
 * appartiennent à la SOURCE ; réceptionner, à la DESTINATION.
 *
 * ⚠ Proposer « Réceptionner » au magasinier qui a expédié ferait répondre au
 * serveur que l'entrepôt de destination ne lui est pas assigné : la
 * marchandise n'est pas chez lui, c'est à l'autre bout de la réceptionner.
 */
export function cotesDuTransfert(
  membre: MembrePerimetre | null,
  transfert: { source_warehouse: string; destination_warehouse: string },
): { source: boolean; destination: boolean } {
  return {
    source: agitDans(membre, transfert.source_warehouse),
    destination: agitDans(membre, transfert.destination_warehouse),
  };
}
