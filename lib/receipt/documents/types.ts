/**
 * Identification des documents.
 *
 * Le défaut central du ticket précédent : le reçu de vente n'avait AUCUN titre
 * (après l'en-tête, il attaquait directement « Recu: <ref> »), tandis que le
 * reçu de règlement affichait « REÇU DE PAIEMENT » en 11 pt. Deux documents,
 * deux structures d'identification différentes, impossibles à distinguer d'un
 * coup d'œil dans une liasse.
 *
 * Chaque document porte désormais le même dispositif : un bandeau en vidéo
 * inversée sous l'en-tête, et un numéro préfixé par type.
 */

export type DocumentKind =
  | "sale"
  | "credit_sale"
  | "proforma"
  | "debt_payment"
  | "advance"
  | "adjustment"
  | "sale_return"
  | "cash_session"
  | "expense";

export interface DocumentIdentity {
  /** Texte du bandeau inversé. */
  band: string;
  /** Sous-titre sous le bandeau, en petit. */
  sub?: string;
  /** Préfixe attendu du numéro de document. */
  prefix: string;
  /** Libellé de la ligne qui porte le numéro. */
  numberLabel: string;
}

export const DOCUMENT_IDENTITIES: Record<DocumentKind, DocumentIdentity> = {
  sale: { band: "REÇU DE VENTE", prefix: "VT", numberLabel: "Reçu n°" },
  credit_sale: {
    band: "VENTE À CRÉDIT",
    sub: "Facture à régler",
    prefix: "VT",
    numberLabel: "Facture n°",
  },
  proforma: {
    band: "FACTURE PROFORMA",
    sub: "Sans valeur comptable, non fiscale",
    prefix: "PRO",
    numberLabel: "Proforma n°",
  },
  debt_payment: {
    band: "REÇU DE RÈGLEMENT",
    prefix: "RGL",
    numberLabel: "Reçu n°",
  },
  advance: { band: "REÇU D'AVANCE", prefix: "AVC", numberLabel: "Reçu n°" },
  adjustment: {
    band: "AJUSTEMENT DE SOLDE",
    prefix: "AJU",
    numberLabel: "Pièce n°",
  },
  sale_return: { band: "BON DE RETOUR", prefix: "RET", numberLabel: "Bon n°" },
  cash_session: {
    band: "CLÔTURE DE CAISSE (Z)",
    prefix: "CZ",
    numberLabel: "Ticket n°",
  },
  expense: { band: "REÇU DE DÉPENSE", prefix: "DEP", numberLabel: "Reçu n°" },
};

/** Mention portée par toute réimpression, pour la distinguer de l'original. */
export const DUPLICATE_CHIP = "DUPLICATA";
