/**
 * L'imputation d'un règlement client, ANNONCÉE avant d'être faite.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ COPIE TENUE À LA MAIN de `mobile/vf-marchand/src/features/clients/      │
 * │ imputation.ts`, dont les tests font foi. Sa place est                    │
 * │ `@vente-facile/core` ; d'ici là, toute évolution se fait DES DEUX CÔTÉS. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * CECI EST UN APERÇU, PAS UNE DÉCISION : le serveur seul impute et écrit
 * (`contacts.services._settle_open_invoices`). La règle tient en une phrase :
 * **on solde les factures les plus anciennes d'abord, et seul le reliquat
 * devient une avance.** L'ordre n'est pas un détail d'affichage : présenter les
 * factures autrement ferait attendre une imputation différente de celle qui
 * aura lieu.
 *
 * Le montant raisonne dans la devise des FACTURES : un `amount_due` est libellé
 * dans la devise de sa facture, c'est la seule comparaison valide.
 */

export interface FactureAImputer {
  reference: string;
  resteAPayer: number;
}

export interface Imputation {
  /** Factures entièrement soldées, dans l'ordre d'imputation. */
  soldees: string[];
  /** Facture partiellement soldée par le reliquat, s'il y en a une. */
  partielle: string | null;
  /** Ce qui reste après les factures, et qui deviendra une avance. */
  avance: number;
}

/**
 * @param montant  Montant du règlement, DANS LA DEVISE DES FACTURES.
 * @param factures Factures ouvertes, de la plus ancienne à la plus récente.
 */
export function imputer(montant: number, factures: FactureAImputer[]): Imputation {
  const soldees: string[] = [];
  let partielle: string | null = null;
  let reste = montant;

  for (const f of factures) {
    // Une facture dont le reste est nul n'absorbe rien : le serveur la saute.
    if (f.resteAPayer <= 0) continue;
    // À un centième près : un reste de 0,004 né d'une conversion ferait sinon
    // apparaître une facture « partiellement soldée » pour un montant que
    // personne ne peut remettre.
    if (reste <= 0.005) break;

    if (reste + 0.005 >= f.resteAPayer) {
      soldees.push(f.reference);
      reste -= f.resteAPayer;
    } else {
      partielle = f.reference;
      reste = 0;
      break;
    }
  }

  return { soldees, partielle, avance: reste > 0.005 ? reste : 0 };
}

/**
 * Le SIGNE d'un ajustement vient du sens choisi, jamais de la saisie : « -500 »
 * tapé dans « augmenter la dette » inverserait l'opération sans qu'aucun écran
 * ne le dise.
 */
export function montantAjustement(sens: "augmenter" | "reduire", saisi: number): number {
  return (sens === "augmenter" ? 1 : -1) * Math.abs(saisi);
}

/**
 * La part de la dette, dans une devise, que les factures VISIBLES n'expliquent
 * pas. Un caissier sans `sales.view_all` ne lit que ses propres ventes, alors
 * que la dette est celle de tout l'établissement - et le serveur impute aussi
 * les factures d'un collègue, les plus anciennes d'abord.
 */
export function detteNonVisible(dette: number, factures: FactureAImputer[]): number {
  const visible = factures.reduce((s, f) => s + Math.max(0, f.resteAPayer), 0);
  const reste = dette - visible;
  return reste > 0.005 ? reste : 0;
}
