/**
 * Le bordereau d'une réquisition : la proposition du serveur, plus les
 * articles ajoutés à la main.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA PROPOSITION SE FUSIONNE, ELLE NE REMPLACE PLUS LE BORDEREAU.          │
 * │                                                                          │
 * │ Basculer « Ruptures seulement » rechargeait la proposition et ÉCRASAIT   │
 * │ tout : les quantités déjà corrigées repartaient à la suggestion, et un   │
 * │ article ajouté à la main disparaissait sans un mot. On garde désormais   │
 * │ ce que le marchand a saisi pour chaque article encore proposé, et ses    │
 * │ ajouts restent quoi que fasse le filtre. Seul un changement d'entrepôt   │
 * │ vide tout : le stock et le seuil d'un autre dépôt ne disent plus rien.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Le serveur accepte tout article de l'organisation (`create_requisition`) :
 * un article jamais reçu dans ce dépôt n'est jamais proposé - la proposition
 * part des lignes de stock -, et l'ajouter à la main est le seul moyen de le
 * demander.
 */
import type { RequisitionProposal } from "@/actions/stock.actions";
import { lireNombre, type MotifRefus } from "./nombres";

export interface LigneBordereau extends RequisitionProposal {
  retenue: boolean;
  /** La saisie BRUTE : le champ garde ce qui est tapé. */
  quantite: string;
  /** Ajouté à la main : hors de la proposition, il ne part jamais avec elle. */
  ajoutee: boolean;
}

export function fusionnerProposition(
  proposition: RequisitionProposal[],
  precedentes: LigneBordereau[] = []
): LigneBordereau[] {
  const avant = new Map(precedentes.map((l) => [l.product, l]));
  const proposees = proposition.map((p): LigneBordereau => {
    const deja = avant.get(p.product);
    return deja
      ? { ...p, retenue: deja.retenue, quantite: deja.quantite, ajoutee: deja.ajoutee }
      : { ...p, retenue: true, quantite: String(p.suggested), ajoutee: false };
  });
  const dansLaProposition = new Set(proposition.map((p) => p.product));
  const ajoutees = precedentes.filter((l) => l.ajoutee && !dansLaProposition.has(l.product));
  return [...proposees, ...ajoutees];
}

/**
 * Ajoute un article hors proposition. Un article déjà au bordereau n'y entre
 * pas une seconde fois : le serveur refuserait la demande entière pour un
 * doublon (`RequisitionCreateSerializer.validate_items`).
 */
export function ajouterAuBordereau(
  lignes: LigneBordereau[],
  article: Omit<RequisitionProposal, "suggested">
): { lignes: LigneBordereau[]; deja: boolean } {
  if (lignes.some((l) => l.product === article.product)) return { lignes, deja: true };
  return {
    lignes: [
      ...lignes,
      { ...article, suggested: 0, retenue: true, quantite: "", ajoutee: true },
    ],
    deja: false,
  };
}

/** Les lignes qui partiront : cochées, et d'une quantité lisible et positive. */
export function lignesRetenues(lignes: LigneBordereau[]): LigneBordereau[] {
  return lignes.filter((l) => {
    if (!l.retenue) return false;
    const lu = lireNombre(l.quantite);
    return lu.ok && lu.valeur != null && lu.valeur > 0;
  });
}

/** La quantité telle que le serveur l'attend : un point décimal, sans espace. */
export function quantiteEnvoyee(l: LigneBordereau): string {
  const lu = lireNombre(l.quantite);
  return lu.ok && lu.valeur != null ? String(lu.valeur) : l.quantite;
}

/**
 * Le refus d'une ligne cochée dont la quantité ne se lit pas. Sans lui, une
 * saisie « 12,5,0 » sortait du bordereau sans un mot : le marchand envoyait
 * trois articles en croyant en demander quatre. Une ligne décochée, ou vide,
 * n'est pas une faute.
 */
export function refusDeLigne(l: LigneBordereau): MotifRefus | null {
  if (!l.retenue) return null;
  const lu = lireNombre(l.quantite);
  return lu.ok ? null : lu.motif;
}

/** Combien de lignes cochées RETIENNENT l'envoi. */
export function nombreDeRefus(lignes: LigneBordereau[]): number {
  return lignes.filter((l) => refusDeLigne(l) !== null).length;
}

/** Retire une ligne ajoutée à la main ; une ligne proposée se décoche. */
export function retirerDuBordereau(lignes: LigneBordereau[], produit: string): LigneBordereau[] {
  return lignes.filter((l) => !(l.ajoutee && l.product === produit));
}
