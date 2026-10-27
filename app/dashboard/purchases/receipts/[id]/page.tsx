"use client";

/**
 * La fiche d'une réception : on relit ce qui est arrivé, puis on valide.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ VALIDER EST L'ACTE IRRÉVERSIBLE, PAS ANNULER.                            │
 * │                                                                          │
 * │ La validation fait entrer le stock, déplace le COÛT MOYEN PONDÉRÉ du     │
 * │ rayon et inscrit la dette du fournisseur. Elle ne se défait pas depuis   │
 * │ cet écran. Annuler, au contraire, ne touche à rien : un brouillon n'a    │
 * │ rien avancé. Le rouge vit donc dans la confirmation de VALIDATION - même │
 * │ grammaire que les retours, où « rejeter » n'est pas l'acte destructeur.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Ban, CheckCircle2, Loader2, PackageCheck, ArrowLeft } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
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
import { GoodsReceiptStatusBadge } from "@/components/shared/PurchaseStatusBadge";
import { useOrganization } from "@/components/auth/organization-checker";
import { usePermissions } from "@/components/auth/permissions-provider";
import { formatDateTime, formatDate, formatDecimal } from "@/lib/format";
import { useCurrency } from "@/components/providers/currency-provider";
import { createMoneyHelpers } from "@/lib/currency";
import {
  getOrganizationCurrencies,
  type OrganizationCurrency,
} from "@/actions/settings.actions";
import {
  cancelGoodsReceipt,
  completeGoodsReceipt,
  getGoodsReceipt,
  type GoodsReceipt,
} from "@/actions/purchases.actions";

export default function GoodsReceiptDetailPage() {
  const params = useParams();
  const receiptId = String(params?.id ?? "");
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { hasPermission } = usePermissions();
  const { currency: defaultCurrency } = useCurrency();

  const [devises, setDevises] = useState<OrganizationCurrency[]>([]);
  const money = useMemo(
    () => createMoneyHelpers(devises, defaultCurrency),
    [devises, defaultCurrency]
  );

  const [reception, setReception] = useState<GoodsReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState<"complete" | "cancel" | null>(null);

  const jeton = session?.accessToken;

  const charger = useCallback(async () => {
    if (!jeton || !organization || !receiptId) return;
    // ⚠ LE `try/finally` N'EST PAS DÉCORATIF : sans lui, une exception laisse
    // la page sur son tourniquet, indéfiniment, sans rien dire. Les actions
    // avalent leurs erreurs réseau, mais la LECTURE de la réponse peut lever,
    // et un rejet non traité dans un effet ne se voit nulle part. C'est aussi
    // ce qui tait `set-state-in-effect`, et la forme de la page Réquisitions.
    try {
      const r = await getGoodsReceipt(jeton, organization.id, receiptId);
      if (!r.success || !r.data) {
        toast.error(r.message ?? "Réception introuvable");
        setReception(null);
      } else {
        setReception(r.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [jeton, organization, receiptId]);

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
    setConfirmation(null);
    if (r.success) {
      toast.success(succes);
      charger();
    } else {
      toast.error(r.message ?? "L'opération n'a pas abouti");
    }
  };

  const lignes = useMemo(() => reception?.items ?? [], [reception]);
  // ┌────────────────────────────────────────────────────────────────────────┐
  // │ UN MONTANT NE S'ÉCRIT JAMAIS SANS SA DEVISE.                          │
  // │                                                                        │
  // │ « Prix facturé » passait par `formatDecimal`, un formateur de          │
  // │ QUANTITÉS : un nombre nu à trois décimales, sans symbole, dans une     │
  // │ application où le même chiffre vaut soit trois dollars, soit trois     │
  // │ francs. C'est la classe de défaut que `money(x, "")` a déjà coûtée au  │
  // │ dépôt sur vingt et un appels.                                           │
  // │                                                                        │
  // │ La devise est celle de la COMMANDE : une réception n'en porte pas.      │
  // └────────────────────────────────────────────────────────────────────────┘
  const devise = reception?.purchase_order_currency || money.primaryCode;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!reception) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <PackageCheck className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Cette réception est introuvable</p>
          <p className="text-sm text-muted-foreground">
            Elle a peut-être été supprimée, ou elle appartient à un entrepôt
            auquel vous n&apos;avez pas accès.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/purchases/receipts">Retour aux réceptions</Link>
        </Button>
      </div>
    );
  }

  const brouillon = reception.status === "draft";
  const totalRefuse = lignes.reduce(
    (s, l) => s + parseFloat(l.quantity_rejected || "0"),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-0.5">
            <Link
              href="/dashboard/purchases/receipts"
              aria-label="Retour aux réceptions"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{reception.reference}</h1>
              <GoodsReceiptStatusBadge status={reception.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              <Link
                href={`/dashboard/purchases/orders/${reception.purchase_order}`}
                className="hover:underline"
              >
                {reception.purchase_order_reference}
              </Link>
              {" · "}
              {formatDateTime(reception.receipt_date)}
              {reception.warehouse_name ? ` · ${reception.warehouse_name}` : ""}
            </p>
          </div>
        </div>

        {/* Annuler est le geste PRUDENT : il ne touche à rien. Il vit donc en
            haut, en secondaire, loin du bouton qui engage. */}
        {brouillon && hasPermission("purchases.edit") && (
          <Button
            variant="outline"
            size="sm"
            disabled={enCours}
            onClick={() => setConfirmation("cancel")}
          >
            <Ban className="mr-2 h-4 w-4" />
            Annuler la réception
          </Button>
        )}
      </div>

      {/* L'état de la pièce, quand elle n'attend plus de décision. Une
          réception validée sans bandeau ressemblerait à un brouillon auquel
          manqueraient ses boutons. */}
      {!brouillon && (
        <div
          className={
            reception.status === "completed"
              ? "rounded-lg border border-success/30 bg-success/10 p-4 text-sm"
              : "rounded-lg border border-border bg-muted/40 p-4 text-sm"
          }
        >
          {reception.status === "completed" ? (
            <>
              <p className="font-medium">Cette réception est validée.</p>
              <p className="text-muted-foreground">
                Le stock est entré, le coût moyen pondéré a été recalculé et la
                dette du fournisseur est inscrite. Pour défaire une entrée,
                passez par un retour fournisseur.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Cette réception a été annulée.</p>
              <p className="text-muted-foreground">
                Rien n&apos;est entré en rayon, et la commande n&apos;a pas
                avancé.
              </p>
            </>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Articles reçus ({lignes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead className="text-right">Reçu</TableHead>
                  <TableHead className="text-right">Accepté</TableHead>
                  <TableHead className="text-right">Refusé</TableHead>
                  <TableHead className="text-right">Prix facturé</TableHead>
                  <TableHead className="hidden lg:table-cell">Lot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l) => {
                  const refuse = parseFloat(l.quantity_rejected || "0");
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
                      <TableCell className="text-right font-mono">
                        {/* La lecture en contenants vient du SERVEUR : on ne
                            redécoupe jamais une quantité au facteur du jour. */}
                        {l.received_display || formatDecimal(l.quantity_received)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatDecimal(l.quantity_accepted)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {refuse > 0 ? (
                          <span className="text-destructive">
                            {formatDecimal(l.quantity_rejected)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {money.money(parseFloat(l.unit_cost || "0"), devise)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {l.batch_number || "-"}
                        {l.expiry_date && (
                          <span className="ml-1 text-xs">
                            (exp. {formatDate(l.expiry_date)})
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalRefuse > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {/* Ce qui est refusé N'ENTRE PAS en rayon et ne crée aucune
                  dette : seul l'accepté compte. Le dire évite de chercher les
                  unités manquantes à l'inventaire suivant. */}
              {formatDecimal(String(totalRefuse))} unité(s) refusée(s) :
              elles n&apos;entrent pas en rayon et ne sont pas dues.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pièces du fournisseur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <span>
              <span className="text-muted-foreground">Facture : </span>
              {reception.supplier_invoice || <Badge variant="outline">Aucune</Badge>}
            </span>
            <span>
              <span className="text-muted-foreground">Bon de livraison : </span>
              {reception.supplier_delivery_note || (
                <Badge variant="outline">Aucun</Badge>
              )}
            </span>
            {reception.received_by_name && (
              <span>
                <span className="text-muted-foreground">Reçu par : </span>
                {reception.received_by_name}
              </span>
            )}
          </div>
          {reception.notes && (
            <p className="whitespace-pre-line text-muted-foreground">
              {reception.notes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* La décision vit SOUS ce qu'elle engage : on descend lire la réception,
          et le bouton est là où la lecture se termine. Même disposition que la
          fiche de vente, dont les actions étaient au milieu de la page. */}
      {brouillon && (
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          {hasPermission("purchases.receive") ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">Tout est conforme ?</p>
                <p className="text-muted-foreground">
                  La validation fait entrer le stock et inscrit la dette. Elle ne
                  se défait pas.
                </p>
              </div>
              <Button
                className="shrink-0"
                disabled={enCours || lignes.length === 0}
                onClick={() => setConfirmation("complete")}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Valider la réception
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Valider une réception demande le droit « Achats : réceptionner ».
            </p>
          )}
        </div>
      )}

      <AlertDialog
        open={confirmation === "complete"}
        onOpenChange={(o) => !o && setConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider cette réception ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le stock de {reception.warehouse_name} va augmenter, le coût moyen
              pondéré des articles concernés va changer, et la dette du
              fournisseur sera inscrite. Cette validation ne se défait pas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne rien faire</AlertDialogCancel>
            {/* ⚠ LE ROUGE EST ICI, sur l'acte irréversible - et pas sur
                « Annuler », qui ne touche à rien. */}
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                agir(
                  () => completeGoodsReceipt(jeton!, organization!.id, receiptId),
                  "Réception validée : le stock est entré"
                )
              }
            >
              {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Valider
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmation === "cancel"}
        onOpenChange={(o) => !o && setConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette réception ?</AlertDialogTitle>
            <AlertDialogDescription>
              Elle est encore en brouillon : rien n&apos;est entré en rayon, et
              la commande n&apos;a pas avancé. L&apos;annuler ne défait donc
              rien, elle ferme simplement la pièce.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne rien faire</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                agir(
                  () => cancelGoodsReceipt(jeton!, organization!.id, receiptId),
                  "Réception annulée"
                )
              }
            >
              {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Annuler la réception
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
