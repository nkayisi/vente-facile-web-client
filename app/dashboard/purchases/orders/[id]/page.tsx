"use client";

/**
 * La fiche d'une commande d'achat : d'ici on réceptionne, on règle, on retourne.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LES TROIS PIÈCES SE CRÉENT DEPUIS LEUR COMMANDE, ET NULLE PART AILLEURS.│
 * │                                                                          │
 * │ Une réception désigne les lignes d'une commande ; un retour désigne ce   │
 * │ qui a été reçu ; un règlement s'impute sur des commandes ouvertes. Les   │
 * │ offrir depuis une liste vide obligerait le marchand à retrouver sa       │
 * │ commande d'abord, et le serveur refuserait tout ce qui ne la désigne pas.│
 * │ C'est la règle déjà posée sur les retours de vente.                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  PackageCheck,
  Send,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatStrip, StatStripItem } from "@/components/shared/StatStrip";
import {
  GoodsReceiptStatusBadge,
  PurchaseOrderStatusBadge,
  peutReceptionner,
} from "@/components/shared/PurchaseStatusBadge";
import { ReceiveGoodsDialog } from "@/components/purchases/receive-goods-dialog";
import { SupplierPaymentDialog } from "@/components/purchases/supplier-payment-dialog";
import { PurchaseReturnDialog } from "@/components/purchases/purchase-return-dialog";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { usePermissions } from "@/components/auth/permissions-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatDecimal } from "@/lib/format";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  getGoodsReceipts,
  getPurchaseOrder,
  sendPurchaseOrder,
  type GoodsReceipt,
  type PurchaseOrder,
} from "@/actions/purchases.actions";
import {
  getOrganizationCurrencies,
  type OrganizationCurrency,
} from "@/actions/settings.actions";

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = String(params?.id ?? "");
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency: defaultCurrency } = useCurrency();
  const { hasPermission } = usePermissions();

  const [devises, setDevises] = useState<OrganizationCurrency[]>([]);
  const money = useMemo(
    () => createMoneyHelpers(devises, defaultCurrency),
    [devises, defaultCurrency]
  );

  const [commande, setCommande] = useState<PurchaseOrder | null>(null);
  const [receptions, setReceptions] = useState<GoodsReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState<"cancel" | null>(null);
  const [feuille, setFeuille] = useState<"receive" | "pay" | "return" | null>(null);

  const jeton = session?.accessToken;

  const charger = useCallback(async () => {
    if (!jeton || !organization || !orderId) return;
    // ⚠ LE `try/finally` N'EST PAS DÉCORATIF : sans lui, une exception laisse
    // la page sur son tourniquet, indéfiniment, sans rien dire. Les actions
    // avalent leurs erreurs réseau, mais la LECTURE de la réponse peut lever,
    // et un rejet non traité dans un effet ne se voit nulle part. C'est aussi
    // ce qui tait `set-state-in-effect`, et la forme de la page Réquisitions.
    try {
      // Les deux appels partent ensemble : ils ne dépendent pas l'un de l'autre.
      const [po, grns] = await Promise.all([
        getPurchaseOrder(jeton, organization.id, orderId),
        getGoodsReceipts(jeton, organization.id, {
          purchase_order: orderId,
          page_size: 50,
        }),
      ]);
      if (!po.success || !po.data) {
        toast.error(po.message ?? "Commande introuvable");
        setCommande(null);
      } else {
        setCommande(po.data);
      }
      setReceptions(grns.data?.results ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [jeton, organization, orderId]);

  useEffect(() => {
    if (organization) charger();
  }, [organization, charger]);

  useEffect(() => {
    if (!jeton || !organization) return;
    getOrganizationCurrencies(jeton, organization.id).then((r) => {
      if (r.success && r.data) setDevises(r.data);
    });
  }, [jeton, organization]);

  const agir = async (
    action: () => Promise<{ success: boolean; message?: string }>,
    succes: string
  ) => {
    setEnCours(true);
    const r = await action();
    setEnCours(false);
    if (r.success) {
      toast.success(succes);
      charger();
    } else {
      toast.error(r.message ?? "L'opération n'a pas abouti");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!commande) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <FileText className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Cette commande est introuvable</p>
          <p className="text-sm text-muted-foreground">
            Elle a peut-être été supprimée, ou elle appartient à un entrepôt
            auquel vous n&apos;avez pas accès.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/purchases/orders">Retour aux commandes</Link>
        </Button>
      </div>
    );
  }

  const du = parseFloat(commande.amount_due || "0");
  const paye = parseFloat(commande.amount_paid || "0");
  const lignes = commande.items ?? [];
  const resteARecevoir = lignes.some(
    (l) => parseFloat(l.quantity_pending || "0") > 0
  );
  const receptionnable = peutReceptionner(commande.status) && resteARecevoir;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-0.5">
            <Link
              href="/dashboard/purchases/orders"
              aria-label="Retour aux commandes"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{commande.reference}</h1>
              <PurchaseOrderStatusBadge status={commande.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {commande.supplier_name} · {formatDate(commande.order_date)}
              {commande.warehouse_name ? ` · ${commande.warehouse_name}` : ""}
            </p>
          </div>
        </div>

        {/* ┌──────────────────────────────────────────────────────────────┐
            │ LES GESTES RARES ET LOURDS SONT EN HAUT, LOIN DU POUCE.     │
            │                                                              │
            │ Confirmer, envoyer, annuler : on ne les fait pas deux fois   │
            │ par jour. Les actions FRÉQUENTES - réceptionner, régler -    │
            │ vivent plus bas, au contact de ce qu'elles engagent. C'est    │
            │ la disposition retenue sur la fiche de vente.                 │
            └──────────────────────────────────────────────────────────────┘ */}
        <div className="flex flex-wrap items-center gap-2">
          {hasPermission("purchases.edit") &&
            commande.status === "draft" && (
              <Button
                variant="outline"
                size="sm"
                disabled={enCours}
                onClick={() =>
                  agir(
                    () => approvePurchaseOrder(jeton!, organization!.id, orderId),
                    "Commande confirmée"
                  )
                }
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirmer
              </Button>
            )}
          {hasPermission("purchases.edit") &&
            (commande.status === "draft" || commande.status === "confirmed") && (
              <Button
                variant="outline"
                size="sm"
                disabled={enCours}
                onClick={() =>
                  agir(
                    () => sendPurchaseOrder(jeton!, organization!.id, orderId),
                    "Commande marquée comme envoyée"
                  )
                }
              >
                <Send className="mr-2 h-4 w-4" />
                Marquer envoyée
              </Button>
            )}
          {hasPermission("purchases.edit") &&
            commande.status !== "received" &&
            commande.status !== "cancelled" && (
              <Button
                variant="outline"
                size="sm"
                disabled={enCours}
                onClick={() => setConfirmation("cancel")}
              >
                <Ban className="mr-2 h-4 w-4" />
                Annuler la commande
              </Button>
            )}
        </div>
      </div>

      <StatStrip>
        <StatStripItem
          label="Total commandé"
          value={money.money(parseFloat(commande.total || "0"), commande.currency)}
        />
        <StatStripItem
          label="Déjà réglé"
          value={money.money(paye, commande.currency)}
        />
        <StatStripItem
          label="Reste à payer"
          value={money.money(du, commande.currency)}
          tone={du > 0 ? "warn" : "neutral"}
        />
        <StatStripItem label="Lignes" value={String(lignes.length)} />
      </StatStrip>

      {/* Les deux actions FRÉQUENTES, au contact de ce qu'elles engagent. */}
      <div className="flex flex-wrap gap-2">
        {hasPermission("purchases.receive") && receptionnable && (
          <Button onClick={() => setFeuille("receive")}>
            <PackageCheck className="mr-2 h-4 w-4" />
            Réceptionner
          </Button>
        )}
        {hasPermission("purchases.edit") && du > 0 && (
          <Button variant="outline" onClick={() => setFeuille("pay")}>
            <CreditCard className="mr-2 h-4 w-4" />
            Enregistrer un règlement
          </Button>
        )}
        {hasPermission("purchases.edit") &&
          receptions.some((r) => r.status === "completed") && (
            <Button variant="outline" onClick={() => setFeuille("return")}>
              <Undo2 className="mr-2 h-4 w-4" />
              Retourner de la marchandise
            </Button>
          )}
      </div>

      {/* Pourquoi un bouton manque, quand il manque. Un bouton absent sans
          explication enseigne que la fonction n'existe pas. */}
      {!receptionnable && commande.status !== "cancelled" && (
        <p className="text-sm text-muted-foreground">
          {commande.status === "draft"
            ? "Confirmez la commande avant de réceptionner : un brouillon n'a pas encore été passé au fournisseur."
            : resteARecevoir
              ? "Cette commande n'accepte plus de réception."
              : "Tout ce qui était commandé a été reçu."}
        </p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Articles commandés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead className="text-right">Commandé</TableHead>
                  <TableHead className="text-right">Reçu</TableHead>
                  <TableHead className="text-right">Reste</TableHead>
                  <TableHead className="text-right">Prix d&apos;achat</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l) => {
                  const reste = parseFloat(l.quantity_pending || "0");
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.product_name}</div>
                        {l.product_sku && (
                          <div className="text-xs text-muted-foreground">
                            {l.product_sku}
                          </div>
                        )}
                      </TableCell>
                      {/* La lecture en contenants vient du SERVEUR
                          (`ordered_display`) : on ne redécoupe jamais une
                          quantité au facteur du jour. */}
                      <TableCell className="text-right font-mono">
                        {l.ordered_display || formatDecimal(l.quantity_ordered)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatDecimal(l.quantity_received)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {reste > 0 ? (
                          <span className="text-warning">
                            {formatDecimal(l.quantity_pending)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {money.money(parseFloat(l.unit_price || "0"), commande.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {money.money(parseFloat(l.total || "0"), commande.currency)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {receptions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Réceptions ({receptions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="hidden md:table-cell">Facture</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receptions.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/purchases/receipts/${r.id}`}
                          className="hover:underline"
                        >
                          {r.reference}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {formatDateTime(r.receipt_date)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {r.supplier_invoice || "-"}
                      </TableCell>
                      <TableCell>
                        <GoodsReceiptStatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {(commande.notes || commande.terms) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes et conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {commande.notes && (
              <div>
                <p className="font-medium">Notes</p>
                <p className="whitespace-pre-line text-muted-foreground">
                  {commande.notes}
                </p>
              </div>
            )}
            {commande.terms && (
              <div>
                <p className="font-medium">Conditions</p>
                <p className="whitespace-pre-line text-muted-foreground">
                  {commande.terms}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ⚠ LE ROUGE VIT DANS LA CONFIRMATION, sur l'acte irréversible.
          Annuler une commande partiellement reçue laisse le stock entré et la
          dette inscrite : c'est ce que le dialogue doit dire avant. */}
      <AlertDialog
        open={confirmation === "cancel"}
        onOpenChange={(ouvert) => !ouvert && setConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              {commande.status === "partially_received"
                ? "Cette commande a déjà reçu de la marchandise. L'annuler ferme la commande mais NE RETIRE RIEN du stock, et ne défait aucune dette déjà inscrite."
                : "La commande sera fermée et ne pourra plus recevoir de marchandise."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne rien faire</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                agir(
                  () => cancelPurchaseOrder(jeton!, organization!.id, orderId),
                  "Commande annulée"
                )
              }
            >
              {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Annuler la commande
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ⚠ RENDUS CONDITIONNELLEMENT, et ce n'est pas une optimisation :
          c'est ce qui fait de chaque ouverture un MONTAGE, donc un formulaire
          vierge, sans effet de remise à zéro à tenir en phase avec les champs
          qu'on ajoutera. Arbitrage déjà rendu sur les feuilles du terminal.
          Contrepartie assumée : pas d'animation de fermeture. */}
      {feuille === "receive" && (
        <ReceiveGoodsDialog
          open
          onOpenChange={(o: boolean) => !o && setFeuille(null)}
          order={commande}
          onDone={(receiptId: string) => {
            setFeuille(null);
            router.push(`/dashboard/purchases/receipts/${receiptId}`);
          }}
        />
      )}

      {feuille === "pay" && (
        <SupplierPaymentDialog
          open
          onOpenChange={(o: boolean) => !o && setFeuille(null)}
          order={commande}
          onDone={() => {
            setFeuille(null);
            charger();
          }}
        />
      )}

      {feuille === "return" && (
        <PurchaseReturnDialog
          open
          onOpenChange={(o: boolean) => !o && setFeuille(null)}
          order={commande}
          onDone={(returnId: string) => {
            setFeuille(null);
            router.push(`/dashboard/purchases/returns/${returnId}`);
          }}
        />
      )}
    </div>
  );
}
