import { Badge } from "@/components/ui/badge";
import type { QuotationStatus } from "@/actions/sales.actions";

/**
 * Le statut d'un devis, écrit pareil partout.
 *
 * Même motif que `SaleStatusBadge` et `ReturnStatusBadge` : huit pages
 * portaient jadis leur propre table de statuts de vente, et deux copies
 * avaient déjà divergé. On ne recommence pas.
 *
 * **Les couleurs passent par les jetons** : une couleur littérale resterait
 * claire en thème sombre.
 */
const CONFIG: Record<QuotationStatus, { label: string; className: string }> = {
  draft: {
    label: "Brouillon",
    className: "bg-muted text-muted-foreground border-transparent",
  },
  sent: {
    label: "Envoyé",
    className: "bg-primary/15 text-primary border-transparent",
  },
  accepted: {
    label: "Accepté",
    className: "bg-success/15 text-success border-transparent",
  },
  rejected: {
    label: "Refusé",
    className: "bg-destructive/15 text-destructive border-transparent",
  },
  expired: {
    label: "Périmé",
    className: "bg-warning/15 text-warning border-transparent",
  },
  converted: {
    label: "Converti",
    className: "bg-success/15 text-success border-transparent",
  },
};

export function QuotationStatusBadge({ status }: { status: string }) {
  const config = CONFIG[status as QuotationStatus];
  if (!config) return <Badge variant="outline">{status}</Badge>;
  return <Badge className={config.className}>{config.label}</Badge>;
}

export function quotationStatusLabel(status: string): string {
  return CONFIG[status as QuotationStatus]?.label ?? status;
}

/**
 * Un devis est-il PÉRIMÉ à cette date ?
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ PÉRIMÉ AVERTIT, ET NE BLOQUE PAS. LE SERVEUR NE REFUSE RIEN ICI.        │
 * │                                                                          │
 * │ `convert_quotation` ne refuse que `status == 'expired'`, et RIEN dans le │
 * │ dépôt n'assigne jamais ce statut : aucune tâche, aucun signal, aucune    │
 * │ commande. Un devis dont la validité est passée reste donc `sent`, et le  │
 * │ serveur le convertit sans broncher.                                      │
 * │                                                                          │
 * │ Fermer le bouton en annonçant un refus serveur qui n'existe pas faisait  │
 * │ d'un devis parfaitement convertible un CUL-DE-SAC, sans dérogation : le  │
 * │ client accepte ce matin un devis valable jusqu'à hier, et le commerçant  │
 * │ doit tout ressaisir. La validité d'un devis est une promesse commerciale,│
 * │ pas une contrainte technique - c'est au commerçant de décider s'il       │
 * │ l'honore.                                                                 │
 * │                                                                          │
 * │ Ce que l'écran doit faire, c'est le DIRE : pastille, bandeau, et rappel  │
 * │ dans la confirmation que les prix sont ceux du jour du devis.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * La comparaison porte sur des JOURS civils : le jour de l'échéance, le devis
 * vaut encore.
 */
export function isQuotationExpired(validUntil: string | null | undefined): boolean {
  if (!validUntil) return false;
  const jour = new Date(`${validUntil}T23:59:59`);
  if (Number.isNaN(jour.getTime())) return false;
  return jour.getTime() < Date.now();
}
