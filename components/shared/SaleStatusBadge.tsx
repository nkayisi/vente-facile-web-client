import { Badge } from "@/components/ui/badge";
import type { SaleStatus } from "@/actions/sales.actions";

/**
 * Le statut d'une vente, écrit pareil partout.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ HUIT PAGES PORTAIENT LEUR PROPRE `STATUS_CONFIG`, ET LES DEUX COPIES     │
 * │ « VENTES » AVAIENT DÉJÀ DIVERGÉ.                                        │
 * │                                                                          │
 * │ L'historique écrivait « Partiel », le détail de vente « Partiellement    │
 * │ payée » - pour le même code, sur deux écrans qu'on ouvre l'un après      │
 * │ l'autre. Rien ne le signalait, et rien ne l'aurait empêché d'empirer.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * **Les couleurs passent par les jetons**, jamais par `bg-yellow-100` : les
 * variables sont définies pour les deux thèmes dans `globals.css`, et une
 * couleur littérale resterait claire en thème sombre. (Le back-office n'a pas
 * encore de bascule de thème : c'est une préparation, pas une promesse.)
 */
const CONFIG: Record<SaleStatus, { label: string; className: string }> = {
  draft: {
    label: "Brouillon",
    className: "bg-muted text-muted-foreground border-transparent",
  },
  pending: {
    label: "En attente",
    className: "bg-warning/15 text-warning border-transparent",
  },
  completed: {
    label: "Terminée",
    className: "bg-success/15 text-success border-transparent",
  },
  partially_paid: {
    label: "Partiel",
    className: "bg-primary/15 text-primary border-transparent",
  },
  cancelled: {
    label: "Annulée",
    className: "bg-destructive/15 text-destructive border-transparent",
  },
  refunded: {
    label: "Remboursée",
    className: "bg-muted text-muted-foreground border-transparent",
  },
};

/** Le libellé seul, pour un tableau ou un export qui n'a pas de place pour une pastille. */
export function saleStatusLabel(status: string): string {
  return CONFIG[status as SaleStatus]?.label ?? status;
}

export function SaleStatusBadge({ status }: { status: string }) {
  const config = CONFIG[status as SaleStatus];
  // Un statut inconnu s'affiche TEL QUEL plutôt que de disparaître : une
  // pastille absente se lit comme une vente sans statut, ce qui n'existe pas.
  if (!config) return <Badge variant="outline">{status}</Badge>;
  return <Badge className={config.className}>{config.label}</Badge>;
}
