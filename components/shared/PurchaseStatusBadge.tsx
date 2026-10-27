"use client";

/**
 * Les pastilles de statut des achats : commande, réception, retour fournisseur.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ EXTRAITES, ET NON RECOPIÉES DANS CHAQUE PAGE.                           │
 * │                                                                          │
 * │ Huit pages du back-office portaient leur propre `STATUS_CONFIG`, et les │
 * │ deux copies « ventes » avaient DÉJÀ divergé - « Partiel » d'un côté,    │
 * │ « Partiellement payée » de l'autre. C'est pourquoi `SaleStatusBadge`,   │
 * │ `ReturnStatusBadge` et `QuotationStatusBadge` existent, et pourquoi les │
 * │ achats n'en recopient aucune.                                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ Les couleurs passent par les JETONS (`--success`, `--warning`) et non par
 * `bg-green-100` : c'est l'absence de ces deux jetons qui avait produit les huit
 * copies en couleurs dures. L'ambre et non l'orange pour l'avertissement,
 * `--primary` ÉTANT orange dans ce back-office.
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Apparence = {
  label: string;
  classe: string;
};

// ⚠ `text-success` et NON `text-success-foreground` : ce dernier vaut #ffffff
// en thème clair, donc du blanc sur un fond vert à 15 % - illisible. Les
// pastilles de vente et de retour emploient déjà cette forme, et trois
// grammaires de pastille dans le même back-office se verraient.
const NEUTRE = "bg-muted text-muted-foreground border-transparent";
const ATTENTE = "bg-warning/15 text-warning border-transparent";
const ACQUIS = "bg-success/15 text-success border-transparent";
const REFUS = "bg-destructive/15 text-destructive border-transparent";

const COMMANDE: Record<string, Apparence> = {
  draft: { label: "Brouillon", classe: NEUTRE },
  sent: { label: "Envoyée", classe: ATTENTE },
  confirmed: { label: "Confirmée", classe: ATTENTE },
  partially_received: { label: "Partiellement reçue", classe: ATTENTE },
  received: { label: "Reçue", classe: ACQUIS },
  cancelled: { label: "Annulée", classe: REFUS },
};

const RECEPTION: Record<string, Apparence> = {
  draft: { label: "Brouillon", classe: NEUTRE },
  completed: { label: "Validée", classe: ACQUIS },
  cancelled: { label: "Annulée", classe: REFUS },
};

const RETOUR: Record<string, Apparence> = {
  draft: { label: "Brouillon", classe: NEUTRE },
  pending: { label: "En attente", classe: ATTENTE },
  approved: { label: "Approuvé", classe: ATTENTE },
  shipped: { label: "Expédié", classe: ACQUIS },
  completed: { label: "Terminé", classe: ACQUIS },
  cancelled: { label: "Annulé", classe: REFUS },
};

function Pastille({
  table,
  status,
  className,
}: {
  table: Record<string, Apparence>;
  status: string;
  className?: string;
}) {
  // Un statut inconnu rend son CODE plutôt que rien : une pastille vide se lit
  // comme une donnée manquante, alors qu'on sait exactement quoi afficher.
  const apparence = table[status] ?? { label: status, classe: NEUTRE };
  return (
    <Badge className={cn(apparence.classe, className)}>
      {apparence.label}
    </Badge>
  );
}

export function PurchaseOrderStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return <Pastille table={COMMANDE} status={status} className={className} />;
}

export function GoodsReceiptStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return <Pastille table={RECEPTION} status={status} className={className} />;
}

export function PurchaseReturnStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return <Pastille table={RETOUR} status={status} className={className} />;
}

/**
 * Une commande peut-elle encore recevoir de la marchandise ?
 *
 * ⚠ `received` n'est PAS la seule fin : une commande annulée ne reçoit plus
 * rien non plus, et un brouillon n'a pas encore été passé au fournisseur.
 */
export function peutReceptionner(status: string): boolean {
  return status === "sent" || status === "confirmed" || status === "partially_received";
}

/*
 * ⚠ QUATRE EXPORTS ONT ÉTÉ RETIRÉS D'ICI, et c'est délibéré.
 *
 * `purchaseOrderStatusLabel`, `goodsReceiptStatusLabel`,
 * `purchaseReturnStatusLabel` et `receptionEngagee` n'avaient AUCUN appelant :
 * les écrans rendent la pastille, qui porte déjà le libellé, et ils lisent le
 * statut brut quand ils doivent décider. Un export sans appelant est la classe
 * de défaut que ce dépôt a payée trois fois - `apercus.tsx` resté orphelin
 * deux commits, `demanderPush` sans appelant, `lignesRecues` jamais appelée.
 *
 * Les tables `COMMANDE`, `RECEPTION` et `RETOUR` restent la seule vérité des
 * libellés : le jour où un écran a besoin d'un libellé hors pastille, il
 * rouvre une fonction ici plutôt que de recopier une table.
 */
