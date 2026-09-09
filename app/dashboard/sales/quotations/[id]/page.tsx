"use client";

/**
 * La fiche d'un devis, et sa conversion en vente.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CONVERTIR INSCRIT UNE DETTE, ET LE DIALOGUE L'ANNONCE AVANT.            │
 * │                                                                          │
 * │ La conversion crée une vente à crédit : le stock est réservé et le       │
 * │ montant est porté au compte du client. Ce n'est pas ce qu'on attend      │
 * │ d'un bouton qui dit « convertir », et c'est irréversible.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * **Un devis PÉRIMÉ ne se convertit pas**, et le statut en base ne bascule pas
 * tout seul : un devis « envoyé » dont la validité est passée reste `sent`.
 * L'écran compare donc la date lui-même, sinon il propose une conversion que
 * le serveur refusera - et le commerçant l'apprend devant son client.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  FileText,
  Loader2,
  Send,
  ShoppingCart,
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
  QuotationStatusBadge,
  isQuotationExpired,
} from "@/components/shared/QuotationStatusBadge";
import { StatValue } from "@/components/shared/StatValue";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { usePermissions } from "@/components/auth/permissions-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  convertQuotation,
  getQuotation,
  sendQuotation,
  type Quotation,
} from "@/actions/sales.actions";

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency } = useCurrency();
  const { hasPermission } = usePermissions();
  const money = useMemo(() => createMoneyHelpers([], currency), [currency]);

  const [devis, setDevis] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmerConversion, setConfirmerConversion] = useState(false);
  const [enCours, setEnCours] = useState(false);

  // ⚠ Le jeton est extrait AVANT le rappel : lire `session?.accessToken` DANS
  // le corps fait inférer `session` entier au compilateur React, qui refuse
  // alors d'optimiser le composant.
  const jeton = session?.accessToken;

  const charger = useCallback(async () => {
    if (!jeton || !organization || !id) return;
    const reponse = await getQuotation(jeton, organization.id, id);
    setDevis(reponse.success && reponse.data ? reponse.data : null);
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

  const convertir = async () => {
    if (!session?.accessToken || !organization?.id || !devis) return;
    setEnCours(true);
    const reponse = await convertQuotation(session.accessToken, organization.id, devis.id);
    setEnCours(false);
    setConfirmerConversion(false);
    if (reponse.success && reponse.data) {
      toast.success(`Vente ${reponse.data.sale_reference} créée`);
      router.push(`/dashboard/sales/${reponse.data.sale_id}`);
    } else {
      toast.error(reponse.message || "La conversion n'a pas abouti");
    }
  };

  const envoyer = async () => {
    if (!session?.accessToken || !organization?.id || !devis) return;
    setEnCours(true);
    const reponse = await sendQuotation(session.accessToken, organization.id, devis.id);
    setEnCours(false);
    if (reponse.success) {
      toast.success("Devis marqué comme envoyé");
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

  if (!devis) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">Devis introuvable</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/sales/quotations">Revenir aux devis</Link>
        </Button>
      </div>
    );
  }

  const converti = devis.status === "converted";
  const perime = !converti && isQuotationExpired(devis.valid_until);
  // ⚠ `sales.create`, PAS `quotations.*` : `QuotationViewSet.action_permissions`
  // garde `convert` et `send` par les permissions de VENTE. Un code de
  // permission faux NE LÈVE RIEN - `hasPermission` rend `false`, le bouton
  // disparaît, et le marchand conclut que la fonction n'existe pas. C'est le
  // défaut que ce dépôt a déjà payé sur `sales.refund`.
  // ⚠ `perime` N'ENTRE PAS dans ces deux gardes. Le serveur ne refuse que
  // `status == 'expired'`, que rien n'assigne jamais : bloquer ici fermait un
  // devis convertible en invoquant un refus qui n'existe pas. La péremption
  // s'AFFICHE (pastille, bandeau, confirmation) et se décide au comptoir.
  const peutConvertir = hasPermission("sales.create") && !converti;
  const peutEnvoyer = hasPermission("sales.create") && devis.status === "draft";

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-0.5">
            <Link href="/dashboard/sales/quotations" aria-label="Revenir aux devis">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{devis.reference}</h1>
              <QuotationStatusBadge status={devis.status} />
              {perime && devis.status !== "expired" && (
                <Badge
                  variant="outline"
                  className="border-warning/40 bg-warning/10 text-warning"
                >
                  Périmé
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {devis.customer_name || "Client anonyme"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {peutEnvoyer && (
            <Button variant="outline" onClick={envoyer} disabled={enCours}>
              <Send className="mr-2 h-4 w-4" />
              Marquer comme envoyé
            </Button>
          )}
          {peutConvertir && (
            <Button onClick={() => setConfirmerConversion(true)}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Convertir en vente
            </Button>
          )}
        </div>
      </div>

      {/* Un bouton absent sans raison est un cul-de-sac. */}
      {converti ? (
        <Card className="border-muted bg-muted/40">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <ShoppingCart className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">Ce devis a été converti en vente.</p>
              {devis.converted_sale && (
                <Link
                  href={`/dashboard/sales/${devis.converted_sale}`}
                  className="text-muted-foreground underline underline-offset-2"
                >
                  Ouvrir la vente
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ) : perime ? (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
            <div>
              <p className="font-medium">
                Ce devis a expiré le {formatDate(devis.valid_until)}.
              </p>
              <p className="text-muted-foreground">
                Sa validité est passée. Vous pouvez toujours le convertir, aux
                prix du jour où il a été établi ; sinon, établissez-en un
                nouveau.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Total du devis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatValue
              value={money.money(parseFloat(devis.total || "0"), money.primaryCode)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Valable jusqu&apos;au
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              {formatDate(devis.valid_until)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Établi par
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <User className="h-4 w-4 text-muted-foreground" />
              {devis.created_by_name || "-"}
            </p>
            <p className="text-muted-foreground">{formatDateTime(devis.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      {devis.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{devis.notes}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Articles ({devis.items?.length ?? devis.items_count})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">
                    Prix unitaire
                  </TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(devis.items ?? []).map((ligne) => (
                  <TableRow key={ligne.id}>
                    <TableCell>
                      <div className="font-medium">{ligne.product_name}</div>
                      {ligne.product_sku && (
                        <div className="text-xs text-muted-foreground">
                          {ligne.product_sku}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{ligne.quantity}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right font-mono">
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

      <Dialog open={confirmerConversion} onOpenChange={setConfirmerConversion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir ce devis en vente ?</DialogTitle>
            <DialogDescription>
              Une vente à crédit est créée : le stock est réservé et{" "}
              {money.money(parseFloat(devis.total || "0"), money.primaryCode)} sont
              portés au compte de {devis.customer_name || "ce client"}.{" "}
              {perime && (
                <>
                  Sa validité s&apos;est arrêtée le {formatDate(devis.valid_until)}
                  , et les prix retenus seront ceux du devis.{" "}
                </>
              )}
              <strong>Cette opération ne se défait pas.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmerConversion(false)}
              disabled={enCours}
            >
              Annuler
            </Button>
            <Button variant="destructive" onClick={convertir} disabled={enCours}>
              {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Convertir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
