/**
 * Les deux papiers d'une dépense : la DEMANDE à la création, le REÇU au
 * paiement.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LE REÇU NE SORT QU'UNE FOIS L'ARGENT SORTI.                              │
 * │                                                                          │
 * │ Il s'imprimait à la création, alors que la dépense naît en brouillon et  │
 * │ que l'argent ne quitte la caisse qu'au paiement : le bénéficiaire        │
 * │ repartait avec la pièce justificative d'une sortie qui n'avait pas eu    │
 * │ lieu, et pouvait ne jamais avoir lieu (dépense rejetée). Ce qui se       │
 * │ remet à la création est une demande, qui le dit sur le papier.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Module pur : la page et la boîte de paiement l'appellent, le test aussi.
 */
import type { Expense } from "@/actions/cashbook.actions";
import type {
  ExpenseReceiptData,
  ExpenseRequestData,
  ReceiptChrome,
} from "@/lib/receipt";

export type PapierDeDepense = "demande" | "recu";

/**
 * Le papier qu'une dépense peut (ré)imprimer : le reçu une fois payée, la
 * demande tant qu'elle peut encore l'être. Une dépense rejetée ou annulée n'a
 * rien à imprimer : ni sortie à justifier, ni paiement à venir.
 */
export function papierDisponible(status: Expense["status"]): PapierDeDepense | null {
  if (status === "paid") return "recu";
  if (status === "draft" || status === "pending" || status === "approved") return "demande";
  return null;
}

/**
 * « 2026-11-20 » devient « 20/11/2026 ».
 *
 * ⚠ Jamais `new Date("2026-11-20")` : la forme courte est lue en UTC, et un
 * poste à l'ouest de Greenwich imprimerait la VEILLE.
 */
function jourImprime(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

const montant = (e: Pick<Expense, "amount">) => parseFloat(e.amount) || 0;

export function demandeDeDepense(
  depense: Expense,
  chrome: ReceiptChrome,
  { duplicata = false }: { duplicata?: boolean } = {}
): ExpenseRequestData {
  return {
    kind: "expense_request",
    chrome,
    number: depense.reference,
    date: jourImprime(depense.expense_date),
    cashierName: depense.created_by_name || undefined,
    category: depense.category_name || undefined,
    payee: depense.beneficiary || undefined,
    amount: montant(depense),
    currency: depense.currency,
    description: depense.description || undefined,
    isDuplicate: duplicata,
  };
}

/**
 * Le reçu d'une dépense PAYÉE, depuis sa fiche.
 *
 * Le payeur et l'instant viennent de la sortie d'argent vivante : c'est elle
 * qui a été rattachée à celui qui a payé, et datée de l'acte. « Payé par »
 * portait jusqu'ici le nom de celui qui avait SAISI la dépense.
 */
export function recuDeDepense(
  depense: Expense,
  chrome: ReceiptChrome,
  { duplicata = false }: { duplicata?: boolean } = {}
): ExpenseReceiptData {
  const sortie = depense.cash_movements?.find((m) => !m.is_cancelled);
  return {
    kind: "expense",
    chrome,
    number: depense.reference,
    date: sortie?.movement_date
      ? new Date(sortie.movement_date).toLocaleString("fr-CD")
      : jourImprime(depense.paid_date),
    cashierName: sortie?.created_by_name || undefined,
    registerName: sortie?.register_name || undefined,
    category: depense.category_name || undefined,
    payee: depense.beneficiary || undefined,
    paymentMethod: depense.payment_method_name || undefined,
    paymentReference: depense.payment_reference || undefined,
    approvedBy: depense.approved_by_name || undefined,
    amount: montant(depense),
    currency: depense.currency,
    description: depense.description || undefined,
    isDuplicate: duplicata,
  };
}
