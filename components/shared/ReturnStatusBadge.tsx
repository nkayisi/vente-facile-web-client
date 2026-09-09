import { Badge } from "@/components/ui/badge";
import type { ReturnStatus, ReturnType } from "@/actions/sales.actions";

/**
 * Le statut d'un retour, écrit pareil partout.
 *
 * Même motif que `SaleStatusBadge`, et pour la même raison : huit pages
 * portaient leur propre table de statuts de vente, et deux copies avaient déjà
 * divergé. On ne recommence pas avec les retours.
 *
 * **Les couleurs passent par les jetons**, jamais par `bg-yellow-100` : une
 * couleur littérale resterait claire en thème sombre.
 */
const CONFIG: Record<ReturnStatus, { label: string; className: string }> = {
  draft: {
    label: "Brouillon",
    className: "bg-muted text-muted-foreground border-transparent",
  },
  pending: {
    label: "En attente",
    className: "bg-warning/15 text-warning border-transparent",
  },
  approved: {
    label: "Approuvé",
    className: "bg-success/15 text-success border-transparent",
  },
  completed: {
    label: "Terminé",
    className: "bg-success/15 text-success border-transparent",
  },
  rejected: {
    label: "Rejeté",
    className: "bg-destructive/15 text-destructive border-transparent",
  },
};

const TYPES: Record<ReturnType, string> = {
  full: "Retour total",
  partial: "Retour partiel",
  exchange: "Échange",
};

export function ReturnStatusBadge({ status }: { status: string }) {
  const config = CONFIG[status as ReturnStatus];
  // Un statut inconnu s'affiche TEL QUEL : une pastille absente se lirait
  // comme un retour sans statut, ce qui n'existe pas.
  if (!config) return <Badge variant="outline">{status}</Badge>;
  return <Badge className={config.className}>{config.label}</Badge>;
}

export function returnStatusLabel(status: string): string {
  return CONFIG[status as ReturnStatus]?.label ?? status;
}

export function returnTypeLabel(type: string): string {
  return TYPES[type as ReturnType] ?? type;
}

/**
 * Un retour a-t-il DÉJÀ produit son effet ?
 *
 * ⚠ Ni le stock ni la caisse ne bougent avant l'approbation : c'est ce qui
 * rend le brouillon inoffensif et l'approbation irréversible. Les écrans s'en
 * servent pour savoir s'ils peuvent encore proposer une décision.
 */
export function isReturnSettled(status: string): boolean {
  return status === "approved" || status === "completed" || status === "rejected";
}
