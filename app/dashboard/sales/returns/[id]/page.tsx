"use client";

/**
 * La fiche d'un retour, et la décision qu'elle engage.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ « REJETER » N'EST PAS L'ACTION DESTRUCTRICE, ET LE ROUGE MENTIRAIT.     │
 * │                                                                          │
 * │ Rejeter ne bouge NI le stock NI la caisse : c'est le refus d'un          │
 * │ changement, l'état le plus prudent des deux. C'est APPROUVER qui fait    │
 * │ revenir de la marchandise en rayon, sortir de l'argent du tiroir, et qui │
 * │ ne se défait pas. Peindre le refus en rouge dirait l'inverse du risque,  │
 * │ et à force le rouge ne veut plus rien dire là où il compte.              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Le rouge vit donc dans le DIALOGUE de confirmation, sur l'acte irréversible.
 *
 * **« Ne revient pas en stock » est une PASTILLE**, pas une incise de légende :
 * c'est la seule ligne qui décide si de la marchandise revient en rayon ou part
 * à la casse.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  Loader2,
  PackageX,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ReturnStatusBadge,
  isReturnSettled,
  returnStatusLabel,
  returnTypeLabel,
} from "@/components/shared/ReturnStatusBadge";
import { StatValue } from "@/components/shared/StatValue";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { usePermissions } from "@/components/auth/permissions-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import {
  approveSaleReturn,
  getSaleReturn,
  rejectSaleReturn,
  type SaleReturn,
} from "@/actions/sales.actions";

export default function SaleReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency } = useCurrency();
  const { hasPermission } = usePermissions();
  const money = useMemo(() => createMoneyHelpers([], currency), [currency]);

  const [retour, setRetour] = useState<SaleReturn | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [enCours, setEnCours] = useState(false);

  // ⚠ Le jeton est extrait AVANT le rappel : lire `session?.accessToken` DANS
  // le corps fait inférer `session` entier au compilateur React, qui refuse
  // alors d'optimiser le composant.
  const jeton = session?.accessToken;

  const charger = useCallback(async () => {
    if (!jeton || !organization || !id) return;
    const reponse = await getSaleReturn(jeton, organization.id, id);
    setRetour(reponse.success && reponse.data ? reponse.data : null);
    // `isLoading` ne redevient jamais VRAI : un rechargement après une
    // décision ne doit pas faire clignoter toute la page.
    setIsLoading(false);
  }, [jeton, organization, id]);

  // La garde est AU SITE DE L'EFFET, comme sur l'historique et les
  // règlements : elle évite l'appel avant que l'organisation ne soit là, et
  // c'est ce qui distingue les pages qui lintent propre des autres.
  useEffect(() => {
    if (organization) charger();
  }, [organization, charger]);

  const trancher = async () => {
    if (!session?.accessToken || !organization?.id || !retour || !decision) return;
    setEnCours(true);
    const agir = decision === "approve" ? approveSaleReturn : rejectSaleReturn;
    const reponse = await agir(session.accessToken, organization.id, retour.id);
    setEnCours(false);
    setDecision(null);
    if (reponse.success) {
      toast.success(
        decision === "approve" ? "Retour approuvé" : "Retour rejeté"
      );
      charger();
    } else {
      toast.error(reponse.message || "L'opération n'a pas abouti");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!retour) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <PackageX className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">Retour introuvable</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/sales/returns">Revenir aux retours</Link>
        </Button>
      </div>
    );
  }

  const regle = isReturnSettled(retour.status);
  const peutApprouver = hasPermission("sale_returns.approve");
  const remboursement = parseFloat(retour.refund_amount || "0");

  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="mt-0.5">
          <Link href="/dashboard/sales/returns" aria-label="Revenir aux retours">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{retour.reference}</h1>
            <ReturnStatusBadge status={retour.status} />
            <Badge variant="outline">{returnTypeLabel(retour.return_type)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Sur la vente{" "}
            <Link
              href={`/dashboard/sales/${retour.original_sale}`}
              className="underline underline-offset-2"
            >
              {retour.original_sale_reference}
            </Link>
          </p>
        </div>
      </div>

      {/* Un retour déjà tranché ressemblerait sinon à un retour en attente
          auquel manqueraient ses boutons. */}
      {regle && (
        <Card className="border-muted bg-muted/40">
          <CardContent className="flex items-start gap-3 py-4">
            <Check className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">
                {returnStatusLabel(retour.status)}
                {retour.approved_by_name ? ` par ${retour.approved_by_name}` : ""}
              </p>
              {retour.approved_at && (
                <p className="text-muted-foreground">
                  {formatDateTime(retour.approved_at)}
                </p>
              )}
              <p className="text-muted-foreground">
                {retour.status === "rejected"
                  ? "Ni le stock ni la caisse n'ont bougé."
                  : "Le stock et la caisse ont été mis à jour."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Deux lectures, et deux seulement : ce qui est rendu, ce qui sort. */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Valeur rendue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatValue
              value={money.money(parseFloat(retour.total_amount || "0"), money.primaryCode)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Sort de la caisse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatValue value={money.money(remboursement, money.primaryCode)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Enregistré par
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <User className="h-4 w-4 text-muted-foreground" />
              {retour.created_by_name || "-"}
            </p>
            <p className="text-muted-foreground">{formatDateTime(retour.return_date)}</p>
          </CardContent>
        </Card>
      </div>

      {retour.reason && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Motif</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{retour.reason}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Articles rendus ({retour.items?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">
                    Prix unitaire
                  </TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(retour.items ?? []).map((ligne) => (
                  <TableRow key={ligne.id}>
                    <TableCell>
                      <div className="font-medium">{ligne.product_name}</div>
                      {/* Une PASTILLE, pas une incise : c'est la seule ligne
                          qui décide si la marchandise revient en rayon. */}
                      {!ligne.restock && (
                        <Badge
                          variant="outline"
                          className="mt-1 border-warning/40 bg-warning/10 text-warning"
                        >
                          Ne revient pas en stock
                        </Badge>
                      )}
                      {ligne.reason && (
                        <p className="mt-1 text-xs text-muted-foreground">{ligne.reason}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{ligne.quantity}</TableCell>
                    <TableCell className="text-right font-mono hidden sm:table-cell">
                      {money.money(parseFloat(ligne.unit_price || "0"), money.primaryCode)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money.money(parseFloat(ligne.total || "0"), money.primaryCode)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* La décision, avec le montant qu'elle engage AU-DESSUS d'elle : c'est
          ce qu'on doit avoir sous les yeux au moment d'appuyer. */}
      {!regle && (
        <Card>
          <CardContent className="space-y-3 py-4">
            {peutApprouver ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Approuver remet la marchandise cochée en stock et fait sortir{" "}
                  <span className="font-medium text-foreground">
                    {money.money(remboursement, money.primaryCode)}
                  </span>{" "}
                  de la caisse. Cela ne se défait pas.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => setDecision("reject")}>
                    <Ban className="mr-2 h-4 w-4" />
                    Rejeter
                  </Button>
                  <Button onClick={() => setDecision("approve")}>
                    <Check className="mr-2 h-4 w-4" />
                    Approuver le retour
                  </Button>
                </div>
              </>
            ) : (
              // Un bouton absent sans raison est un cul-de-sac.
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                Vous n&apos;avez pas le droit d&apos;approuver un retour
                (<code className="text-xs">sale_returns.approve</code>).
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={decision !== null} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === "approve" ? "Approuver ce retour ?" : "Rejeter ce retour ?"}
            </DialogTitle>
            <DialogDescription>
              {decision === "approve" ? (
                <>
                  La marchandise cochée revient en stock et{" "}
                  {money.money(remboursement, money.primaryCode)} sortent de la
                  caisse. <strong>Cette opération ne se défait pas.</strong>
                </>
              ) : (
                <>
                  Le retour est refusé : ni le stock ni la caisse ne bougent, et
                  la marchandise reste chez le client.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)} disabled={enCours}>
              Annuler
            </Button>
            <Button
              variant={decision === "approve" ? "destructive" : "default"}
              onClick={trancher}
              disabled={enCours}
            >
              {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {decision === "approve" ? "Approuver" : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
