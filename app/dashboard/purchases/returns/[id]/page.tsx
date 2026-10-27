"use client";

/**
 * La fiche d'un retour fournisseur, et ses deux décisions.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ APPROUVER EST L'ACTE DESTRUCTEUR, PAS ANNULER.                          │
 * │                                                                          │
 * │ Approuver SORT la marchandise du rayon. Expédier éteint la dette du      │
 * │ fournisseur et ne rend en caisse que le reliquat. Annuler, lui, ne bouge │
 * │ rien : c'est le refus d'un changement, l'état le plus prudent des deux.  │
 * │ Peindre l'annulation en rouge dirait l'inverse du risque - c'est le      │
 * │ défaut corrigé sur les retours de vente le 2 octobre.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  Truck,
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
import { PurchaseReturnStatusBadge } from "@/components/shared/PurchaseStatusBadge";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { usePermissions } from "@/components/auth/permissions-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { formatDate, formatDecimal } from "@/lib/format";
import {
  approvePurchaseReturn,
  cancelPurchaseReturn,
  getPurchaseReturn,
  shipPurchaseReturn,
  type PurchaseReturn,
} from "@/actions/purchases.actions";

export default function PurchaseReturnDetailPage() {
  const params = useParams();
  const returnId = String(params?.id ?? "");
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency: defaultCurrency } = useCurrency();
  const { hasPermission } = usePermissions();

  const money = useMemo(
    () => createMoneyHelpers([], defaultCurrency),
    [defaultCurrency]
  );

  const [retour, setRetour] = useState<PurchaseReturn | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState<
    "approve" | "ship" | "cancel" | null
  >(null);

  const jeton = session?.accessToken;

  const charger = useCallback(async () => {
    if (!jeton || !organization || !returnId) return;
    // ⚠ LE `try/finally` N'EST PAS DÉCORATIF : sans lui, une exception laisse
    // la page sur son tourniquet, indéfiniment, sans rien dire. Les actions
    // avalent leurs erreurs réseau, mais la LECTURE de la réponse peut lever,
    // et un rejet non traité dans un effet ne se voit nulle part. C'est aussi
    // ce qui tait `set-state-in-effect`, et la forme de la page Réquisitions.
    try {
      const r = await getPurchaseReturn(jeton, organization.id, returnId);
      if (!r.success || !r.data) {
        toast.error(r.message ?? "Retour introuvable");
        setRetour(null);
      } else {
        setRetour(r.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [jeton, organization, returnId]);

  useEffect(() => {
    if (organization) charger();
  }, [organization, charger]);

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!retour) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <Undo2 className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Ce retour est introuvable</p>
          <p className="text-sm text-muted-foreground">
            Il a peut-être été supprimé, ou il appartient à un entrepôt auquel
            vous n&apos;avez pas accès.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/purchases/returns">Retour à la liste</Link>
        </Button>
      </div>
    );
  }

  const lignes = retour.items ?? [];
  const valeur = parseFloat(retour.total_amount || "0");
  // ┌────────────────────────────────────────────────────────────────────────┐
  // │ LES MONTANTS D'UN RETOUR SONT DANS LA DEVISE DE SA COMMANDE.          │
  // │                                                                        │
  // │ Ils étaient rendus sous `money.primaryCode`, donc sous le symbole de   │
  // │ la devise PRINCIPALE, alors que `expedier_retour` éteint la dette dans │
  // │ `purchase_order.currency` : un retour de 40 000 USD s'annonçait        │
  // │ « 40 000 FC » dans la phrase même qui dit qu'approuver ne se défait    │
  // │ pas. C'est le défaut corrigé sur l'historique des ventes, où une       │
  // │ facture de 50 $ s'écrivait « 50 FC ».                                  │
  // │                                                                        │
  // │ Un retour SANS commande d'origine n'a pas de devise à lui : la         │
  // │ principale est alors ce que le serveur résoudra aussi.                  │
  // └────────────────────────────────────────────────────────────────────────┘
  const devise = retour.purchase_order_currency || money.primaryCode;
  const brouillon = retour.status === "draft";
  const approuve = retour.status === "approved";
  const annulable = brouillon || approuve;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-0.5">
            <Link
              href="/dashboard/purchases/returns"
              aria-label="Retour à la liste"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{retour.reference}</h1>
              <PurchaseReturnStatusBadge status={retour.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {retour.supplier_name} · {formatDate(retour.return_date)}
              {retour.warehouse_name ? ` · ${retour.warehouse_name}` : ""}
              {retour.purchase_order && (
                <>
                  {" · "}
                  <Link
                    href={`/dashboard/purchases/orders/${retour.purchase_order}`}
                    className="hover:underline"
                  >
                    commande d&apos;origine
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Annuler est le geste PRUDENT : il ne bouge rien tant que le retour
            n'est pas expédié. Il vit en haut, en secondaire. */}
        {annulable && hasPermission("purchases.edit") && (
          <Button
            variant="outline"
            size="sm"
            disabled={enCours}
            onClick={() => setConfirmation("cancel")}
          >
            <Ban className="mr-2 h-4 w-4" />
            Annuler le retour
          </Button>
        )}
      </div>

      <StatStrip>
        <StatStripItem
          label="Valeur rendue"
          value={money.money(valeur, devise)}
        />
        <StatStripItem label="Articles" value={String(lignes.length)} />
        <StatStripItem
          label="Créé par"
          value={retour.created_by_name || "-"}
        />
      </StatStrip>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Motif du retour</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm">{retour.reason}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Articles rendus ({lignes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="text-right">Coût unitaire</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l, i) => (
                  <TableRow key={l.id ?? i}>
                    <TableCell>
                      <div className="font-medium">{l.product_name}</div>
                      {l.product_sku && (
                        <div className="text-xs text-muted-foreground">
                          {l.product_sku}
                        </div>
                      )}
                      {l.reason && (
                        <div className="text-xs text-muted-foreground">
                          {l.reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatDecimal(l.quantity)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money.money(parseFloat(l.unit_cost || "0"), devise)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money.money(parseFloat(l.total || "0"), devise)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* La décision vit SOUS ce qu'elle engage. */}
      {(brouillon || approuve) && (
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          {hasPermission("purchases.edit") ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                {brouillon ? (
                  <>
                    <p className="font-medium">Prêt à sortir du rayon ?</p>
                    <p className="text-muted-foreground">
                      Approuver retire {money.money(valeur, devise)} de
                      marchandise du stock de {retour.warehouse_name}. Cela ne se
                      défait pas.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">La marchandise est partie ?</p>
                    <p className="text-muted-foreground">
                      Expédier éteint d&apos;abord la dette du fournisseur ; seul
                      ce qui dépasse revient en caisse.
                    </p>
                  </>
                )}
              </div>
              <Button
                className="shrink-0"
                disabled={enCours}
                onClick={() => setConfirmation(brouillon ? "approve" : "ship")}
              >
                {brouillon ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approuver le retour
                  </>
                ) : (
                  <>
                    <Truck className="mr-2 h-4 w-4" />
                    Marquer expédié
                  </>
                )}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Décider d&apos;un retour demande le droit « Achats : modifier ».
            </p>
          )}
        </div>
      )}

      {retour.status === "shipped" && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
          <p className="font-medium">Ce retour est expédié.</p>
          <p className="text-muted-foreground">
            La dette du fournisseur a été réduite d&apos;autant, et le reliquat
            éventuel est entré en caisse.
          </p>
        </div>
      )}

      {/* ⚠ LE ROUGE EST SUR L'APPROBATION, acte irréversible qui vide le rayon
          - et pas sur l'annulation, qui ne touche à rien. */}
      <AlertDialog
        open={confirmation === "approve"}
        onOpenChange={(o) => !o && setConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approuver ce retour ?</AlertDialogTitle>
            <AlertDialogDescription>
              La marchandise sera retirée du stock de {retour.warehouse_name}.
              Cette sortie ne se défait pas depuis cet écran.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne rien faire</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                agir(
                  () => approvePurchaseReturn(jeton!, organization!.id, returnId),
                  "Retour approuvé : la marchandise est sortie du rayon"
                )
              }
            >
              {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approuver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmation === "ship"}
        onOpenChange={(o) => !o && setConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marquer ce retour comme expédié ?</AlertDialogTitle>
            <AlertDialogDescription>
              La dette du fournisseur sera réduite de{" "}
              {money.money(valeur, devise)} au plus. S&apos;il ne
              vous devait pas tant, la différence entrera en caisse comme un
              remboursement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne rien faire</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                agir(
                  () => shipPurchaseReturn(jeton!, organization!.id, returnId),
                  "Retour expédié"
                )
              }
            >
              {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Marquer expédié
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
            <AlertDialogTitle>Annuler ce retour ?</AlertDialogTitle>
            <AlertDialogDescription>
              {approuve
                ? "La marchandise a déjà été retirée du rayon par l'approbation. L'annulation ferme le retour mais NE LA REMET PAS en stock : passez par une entrée de stock pour cela."
                : "Rien n'a encore bougé : le retour sera simplement fermé."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne rien faire</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                agir(
                  () => cancelPurchaseReturn(jeton!, organization!.id, returnId),
                  "Retour annulé"
                )
              }
            >
              {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Annuler le retour
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
