"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Loader2,
  Receipt,
  User,
  Calendar,
  CreditCard,
  Package,
  Printer,
  XCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Percent,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatDateTime, formatPoints } from "@/lib/format";
import { PermissionGate } from "@/components/auth/permission-gate";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getSale,
  cancelSale,
  markReceiptPrinted,
  addPaymentToSale,
  getPaymentMethods,
  Sale,
  SaleStatus,
  PaymentMethod,
} from "@/actions/sales.actions";
import { getOrganizationCurrencies, OrganizationCurrency } from "@/actions/settings.actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildPaymentReceipt,
  buildSaleReceipt,
  saleReceiptFromSale,
  type PaymentReceiptData,
} from "@/lib/receipt";
import { useReceiptChrome } from "@/hooks/use-receipt-chrome";
import { useReceiptPrinter } from "@/hooks/use-receipt-printer";

const STATUS_CONFIG: Record<SaleStatus, { label: string; color: string; icon: any }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700", icon: Clock },
  pending: { label: "En attente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  completed: { label: "Terminée", color: "bg-green-100 text-green-700", icon: CheckCircle },
  partially_paid: { label: "Partiellement payée", color: "bg-blue-100 text-blue-700", icon: Clock },
  cancelled: { label: "Annulée", color: "bg-red-100 text-red-700", icon: XCircle },
  refunded: { label: "Remboursée", color: "bg-purple-100 text-purple-700", icon: XCircle },
};

export default function SaleDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const saleId = params.id as string;

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const { chrome, paperWidth, settings } = useReceiptChrome(
    session?.accessToken,
    organization
  );
  const printer = useReceiptPrinter();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  // Add payment dialog state
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [addPaymentMethod, setAddPaymentMethod] = useState<string>("");
  const [addPaymentAmount, setAddPaymentAmount] = useState<string>("");
  const [addPaymentReference, setAddPaymentReference] = useState<string>("");
  // Multi-devise : devise du règlement + taux org (conversion & validation).
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);
  const [addPaymentCurrency, setAddPaymentCurrency] = useState<string>("");
  const [addPaymentNotes, setAddPaymentNotes] = useState<string>("");
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  // Garde anti double-clic synchrone (cf. POS page)
  const addPaymentSubmittingRef = useRef(false);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          const saleResult = await getSale(session.accessToken, org.id, saleId);
          if (saleResult.success && saleResult.data) {
            setSale(saleResult.data);
          }
        }
      } catch (error) {
        console.error("Error fetching sale:", error);
        toast.error("Erreur lors du chargement de la vente");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.accessToken, saleId]);

  // Handle print receipt
  const handlePrintReceipt = async () => {
    if (!session?.accessToken || !organization?.id || !sale || !chrome) return;

    const job = printer.begin();
    setIsPrinting(true);

    try {
      const blocks = buildSaleReceipt(
        saleReceiptFromSale(sale, {
          chrome,
          settings,
          // Une réimpression sort marquée DUPLICATA : un original et sa copie
          // doivent rester distinguables.
          isDuplicate: sale.receipt_printed,
        })
      );

      job.present(blocks, {
        filename: `recu-${sale.reference}.pdf`,
        paperWidth,
        successMessage: sale.receipt_printed ? "Duplicata prêt" : "Reçu prêt",
      });

      const result = await markReceiptPrinted(
        session.accessToken,
        organization.id,
        sale.id
      );
      if (result.success && result.data) setSale(result.data);
    } catch (error) {
      job.abort();
      console.error("Error printing receipt:", error);
      toast.error("Erreur lors de l'impression du reçu");
    } finally {
      setIsPrinting(false);
    }
  };

  // Charger les méthodes de paiement + devises au premier affichage du dialog
  const ensurePaymentMethodsLoaded = async () => {
    if (!session?.accessToken || !organization?.id) return;
    if (paymentMethods.length === 0) {
      const res = await getPaymentMethods(session.accessToken, organization.id, { is_active: true });
      if (res.success && res.data) {
        setPaymentMethods(res.data);
        const def = res.data.find(m => m.is_default) || res.data[0];
        if (def) setAddPaymentMethod(def.id);
      }
    }
    if (orgCurrencies.length === 0) {
      const cur = await getOrganizationCurrencies(session.accessToken, organization.id);
      if (cur.success && cur.data) setOrgCurrencies(cur.data);
    }
    // Devise du règlement par défaut = devise de la vente.
    if (sale) setAddPaymentCurrency(sale.currency);
  };

  // Conversions basées sur OrganizationCurrency.exchange_rate (principale par unité).
  const payRateOf = (code: string) => {
    const c = orgCurrencies.find(x => x.currency_code === code);
    const r = c ? parseFloat(c.exchange_rate) : 1;
    return r > 0 ? r : 1;
  };
  const paySymbolOf = (code: string) =>
    orgCurrencies.find(x => x.currency_code === code)?.currency_symbol || code;
  // Convertit un montant de la devise du règlement vers la devise de la vente.
  const payToSaleCurrency = (amount: number) => {
    if (!sale || !addPaymentCurrency || addPaymentCurrency === sale.currency) return amount;
    return (amount * payRateOf(addPaymentCurrency)) / payRateOf(sale.currency);
  };

  // Pré-remplir le montant avec amount_due lors de l'ouverture de la modale
  const openAddPaymentDialog = async () => {
    if (!sale) return;
    setAddPaymentAmount(sale.amount_due || "0");
    setAddPaymentReference("");
    setAddPaymentNotes("");
    await ensurePaymentMethodsLoaded();
    setShowAddPaymentDialog(true);
  };

  const handleAddPayment = async () => {
    if (addPaymentSubmittingRef.current) return;
    if (!sale || !session?.accessToken || !organization?.id) return;

    const amt = parseFloat(addPaymentAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Le montant doit être positif.");
      return;
    }
    const due = parseFloat(sale.amount_due) || 0;
    // Le restant dû est en devise de la vente : on compare la valeur convertie.
    const amtInSale = payToSaleCurrency(amt);
    if (amtInSale > due + 0.01) {
      toast.error(`Le montant ne peut pas dépasser le restant dû (${formatPrice(due)} ${sale.currency}).`);
      return;
    }
    if (!addPaymentMethod) {
      toast.error("Sélectionnez une méthode de paiement.");
      return;
    }

    addPaymentSubmittingRef.current = true;
    setIsAddingPayment(true);
    // Ouvert avant l'appel réseau : le navigateur bloque toute fenêtre ouverte
    // en dehors du geste de l'utilisateur.
    const job = printer.begin();
    try {
      const res = await addPaymentToSale(session.accessToken, organization.id, sale.id, {
        payment_method: addPaymentMethod,
        amount: amt,
        // Devise du règlement si différente de la vente - conversion backend.
        ...(addPaymentCurrency && addPaymentCurrency !== sale.currency
          ? { currency: addPaymentCurrency }
          : {}),
        reference: addPaymentReference || undefined,
        notes: addPaymentNotes || undefined,
      });
      if (!res.success) {
        job.abort();
        toast.error(res.message || "Erreur lors de l'ajout du paiement.");
        return;
      }

      // Ce parcours n'imprimait aucun reçu, alors que le même règlement fait
      // depuis la fiche client ou depuis les factures en attente en produisait
      // un : le client repartait les mains vides selon l'écran utilisé.
      const updated = res.data;
      if (chrome && updated) {
        const settled = updated.payments?.[updated.payments.length - 1];
        const method = paymentMethods.find((m) => m.id === addPaymentMethod);
        const receipt: PaymentReceiptData = {
          kind: "debt_payment",
          chrome,
          number: settled?.receipt_number || sale.reference,
          date: new Date().toLocaleString("fr-CD"),
          cashierName: sale.sold_by_name || undefined,
          customerName: sale.customer_name || undefined,
          customerPhone: sale.customer_phone || undefined,
          paymentMethod: method?.name || undefined,
          paymentReference: addPaymentReference || undefined,
          amountPaid: amtInSale,
          currency: sale.currency,
          tenderedAmount: amt,
          tenderedCurrency: addPaymentCurrency || sale.currency,
          invoice: {
            reference: sale.reference,
            total: parseFloat(sale.total) || 0,
            previouslyPaid: parseFloat(sale.amount_paid) || 0,
            remaining: parseFloat(updated.amount_due) || 0,
            currency: sale.currency,
          },
          debt: {
            before: due,
            after: parseFloat(updated.amount_due) || 0,
            currency: sale.currency,
          },
          notes: addPaymentNotes || undefined,
        };
        job.present(buildPaymentReceipt(receipt), {
          filename: `reglement-${sale.reference}.pdf`,
          paperWidth,
          successMessage: "Paiement enregistré",
        });
      } else {
        job.abort();
        toast.success("Paiement enregistré.");
      }

      // Refresh sale data
      const refreshed = await getSale(session.accessToken, organization.id, sale.id);
      if (refreshed.success && refreshed.data) setSale(refreshed.data);
      setShowAddPaymentDialog(false);
    } catch (err) {
      job.abort();
      console.error(err);
      toast.error("Erreur réseau lors de l'ajout du paiement.");
    } finally {
      setIsAddingPayment(false);
      addPaymentSubmittingRef.current = false;
    }
  };

  // Handle cancel
  const handleCancel = async () => {
    if (!session?.accessToken || !organization?.id) return;

    setIsCancelling(true);

    try {
      const result = await cancelSale(session.accessToken, organization.id, saleId);
      if (result.success) {
        toast.success("Vente annulée avec succès");
        // Refresh sale data
        const saleResult = await getSale(session.accessToken, organization.id, saleId);
        if (saleResult.success && saleResult.data) {
          setSale(saleResult.data);
        }
        setShowCancelDialog(false);
      } else {
        toast.error(result.message || "Erreur lors de l'annulation");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsCancelling(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vente introuvable</h1>
          </div>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Cette vente n'existe pas ou a été supprimée.</p>
            <Button onClick={() => router.push("/dashboard/sales/history")} className="mt-4">
              Retour à l'historique
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[sale.status];
  const StatusIcon = statusConfig.icon;
  const canCancel = !["cancelled", "refunded"].includes(sale.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{sale.reference}</h1>
              <p className="text-sm text-gray-500 mt-1">{formatDateTime(sale.sale_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${statusConfig.color}`}>
              <StatusIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Statut</p>
              <p className="text-lg font-semibold">{statusConfig.label}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(sale.status === 'pending' || sale.status === 'partially_paid') && (
            <PermissionGate permission="sales.create">
              <Button
                variant="outline"
                onClick={openAddPaymentDialog}
                className="border-green-600 text-green-700 hover:bg-green-50"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Ajouter un paiement
              </Button>
            </PermissionGate>
          )}
          {/* Toujours proposable : une imprimante à court de papier ne doit pas
              faire perdre le reçu. Une réimpression sort marquée DUPLICATA. */}
          <Button
            variant="outline"
            onClick={handlePrintReceipt}
            disabled={isPrinting}
            className="hover:bg-orange-50 active:scale-[0.96] transition-transform"
          >
            {isPrinting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Receipt className="h-4 w-4 mr-2" />
            )}
            {isPrinting
              ? "Impression..."
              : sale.receipt_printed
                ? "Réimprimer le reçu"
                : "Imprimer le reçu"}
          </Button>
          {canCancel && (
            <PermissionGate permission="sales.cancel">
              <Button
                variant="outline"
                className="text-red-600 border-red-600 hover:bg-red-50"
                onClick={() => setShowCancelDialog(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Annuler
              </Button>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sale Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Receipt className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Référence</p>
                <p className="font-medium">{sale.reference}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Client</p>
                <p className="font-medium">{sale.customer_name || "Client anonyme"}</p>
                {sale.customer_phone && (
                  <p className="text-sm text-gray-500">{sale.customer_phone}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Date de vente</p>
                <p className="font-medium">{formatDateTime(sale.sale_date)}</p>
              </div>
            </div>

            {sale.sold_by_name && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Vendu par</p>
                  <p className="font-medium">{sale.sold_by_name}</p>
                </div>
              </div>
            )}

            {sale.register_name && (
              <div className="flex items-start gap-3">
                <Receipt className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Caisse</p>
                  <p className="font-medium">{sale.register_name}</p>
                </div>
              </div>
            )}

            {sale.notes && (
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500 mb-2">Notes</p>
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">{sale.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Paiement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sous-total</span>
                <span>{formatPrice(sale.subtotal)}</span>
              </div>
              {parseFloat(sale.tax_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Taxes</span>
                  <span>{formatPrice(sale.tax_amount)}</span>
                </div>
              )}
              {/* `discount_amount` englobe la part réglée en points : les
                  afficher l'une sous l'autre sans retrancher montrerait deux
                  fois la même somme. Même découpage que `splitDiscount` du
                  reçu, pour que l'écran et le papier racontent la même chose. */}
              {(() => {
                const loyaltyDiscount = Math.max(
                  0, parseFloat(sale.loyalty_redemption_amount || "0") || 0,
                );
                const commercialDiscount = Math.max(
                  0, parseFloat(sale.discount_amount) - loyaltyDiscount,
                );
                return (
                  <>
                    {commercialDiscount > 0 && (
                      <div className="flex justify-between text-sm text-orange-600">
                        <span className="flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          Remise
                          {parseFloat(sale.discount_percentage) > 0 && ` (${sale.discount_percentage}%)`}
                        </span>
                        <span>-{formatPrice(commercialDiscount)}</span>
                      </div>
                    )}
                    {loyaltyDiscount > 0 && (
                      <div className="flex justify-between text-sm text-amber-600">
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          Remise fidélité
                          {(sale.loyalty_points_used ?? 0) > 0 &&
                            ` (${formatPoints(sale.loyalty_points_used)} pts)`}
                        </span>
                        <span>-{formatPrice(loyaltyDiscount)}</span>
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span className="text-orange-600">{formatPrice(sale.total)}</span>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Montant payé</span>
                <span className="text-green-600 font-medium">{formatPrice(sale.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Reste à payer</span>
                <span className={parseFloat(sale.amount_due) > 0 ? "text-red-600 font-medium" : ""}>
                  {formatPrice(sale.amount_due)}
                </span>
              </div>
              {parseFloat(sale.change_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Monnaie rendue</span>
                  <span>{formatPrice(sale.change_amount)}</span>
                </div>
              )}
            </div>

            {/* Fidélité : même prédicat que `showsLoyaltyBlock` du reçu, pour
                que l'écran n'affiche jamais un bloc que le papier tait, ni
                l'inverse. Les valeurs viennent du registre côté serveur, jamais
                d'un recalcul de barème. */}
            {sale.loyalty_program_active && sale.customer &&
              ((sale.loyalty_points_earned ?? 0) > 0 ||
                (sale.loyalty_points_used ?? 0) > 0 ||
                sale.loyalty_points_balance !== undefined) && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-amber-500" />
                  Points de fidélité
                </p>
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  {(sale.loyalty_points_earned ?? 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-700">Points gagnés</span>
                      <span className="font-medium text-amber-800">
                        +{formatPoints(sale.loyalty_points_earned)} pts
                      </span>
                    </div>
                  )}
                  {(sale.loyalty_points_used ?? 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-700">Points utilisés</span>
                      <span className="font-medium text-amber-800">
                        -{formatPoints(sale.loyalty_points_used)} pts
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-amber-200 pt-2 text-sm">
                    <span className="text-amber-700">Solde du client</span>
                    <span className="font-bold text-amber-800">
                      {formatPoints(sale.loyalty_points_balance)} pts
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Payments List */}
            {sale.payments && sale.payments.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-gray-900 mb-3">Paiements reçus</p>
                <div className="space-y-2">
                  {sale.payments.map(payment => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{payment.payment_method_name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(payment.paid_at).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <span className="font-medium text-green-600">
                        {formatPrice(payment.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Articles ({sale.items?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!sale.items || sale.items.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucun article</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Produit
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Prix unitaire
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Quantité
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Remise
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sale.items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{item.product_name}</p>
                          <p className="text-xs text-gray-500">{item.product_sku}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm">{formatPrice(item.unit_price)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {/* `quantity_display` porte les termes de la facturation
                            (« 2 casiers + 3 bouteilles ») ; le total en unités
                            reste dessous pour le rapprochement de stock. */}
                        <span className="block font-medium">
                          {item.quantity_display?.trim() ||
                            parseFloat(item.quantity).toFixed(0)}
                        </span>
                        {item.packaging_factor ? (
                          <span className="text-xs text-gray-500">
                            {parseFloat(item.quantity).toFixed(0)} au total
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {parseFloat(item.discount_percentage) > 0 ? (
                          <span className="text-orange-600">{item.discount_percentage}%</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium">{formatPrice(item.total)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Annuler la vente</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir annuler cette vente ? Le stock sera remis en inventaire si
              applicable.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Non, garder
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isCancelling}>
              {isCancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Oui, annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog - encaisser un paiement sur une vente pending / partially_paid */}
      <Dialog
        open={showAddPaymentDialog}
        onOpenChange={(open) => {
          setShowAddPaymentDialog(open);
          if (!open) {
            setAddPaymentAmount("");
            setAddPaymentReference("");
            setAddPaymentNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un paiement</DialogTitle>
            <DialogDescription>
              Encaissez un règlement sur cette vente. La vente passera en « Terminée »
              si le total est atteint.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Total facture</span>
                <span className="font-medium">{formatPrice(sale.total)} {sale.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Déjà payé</span>
                <span className="font-medium">{formatPrice(sale.amount_paid)} {sale.currency}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5">
                <span className="text-gray-600 font-semibold">Restant dû</span>
                <span className="font-bold text-green-700">{formatPrice(sale.amount_due)} {sale.currency}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add_payment_method">Méthode de paiement</Label>
              <select
                id="add_payment_method"
                value={addPaymentMethod}
                onChange={(e) => setAddPaymentMethod(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {paymentMethods.length === 0 && (
                  <option value="">- Chargement -</option>
                )}
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="add_payment_amount">Montant</Label>
                {orgCurrencies.length > 1 && (
                  <div className="flex gap-1">
                    {orgCurrencies.map((c) => (
                      <button
                        key={c.currency_code}
                        type="button"
                        onClick={() => setAddPaymentCurrency(c.currency_code)}
                        className={`px-2 py-1 rounded-md border text-xs font-semibold ${addPaymentCurrency === c.currency_code
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-gray-200 bg-white text-gray-500"
                          }`}
                      >
                        {c.currency_code}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input
                id="add_payment_amount"
                type="number"
                min="0"
                step="0.01"
                value={addPaymentAmount}
                onChange={(e) => setAddPaymentAmount(e.target.value)}
                placeholder={sale.amount_due}
              />
              {addPaymentCurrency && sale.currency !== addPaymentCurrency && parseFloat(addPaymentAmount) > 0 && (
                <p className="text-xs text-blue-600">
                  = {formatPrice(payToSaleCurrency(parseFloat(addPaymentAmount)))} {sale.currency}
                  {" "}(reçu en {paySymbolOf(addPaymentCurrency)})
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="add_payment_reference">Référence (optionnel)</Label>
              <Input
                id="add_payment_reference"
                value={addPaymentReference}
                onChange={(e) => setAddPaymentReference(e.target.value)}
                placeholder="N° transaction, chèque, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add_payment_notes">Notes (optionnel)</Label>
              <textarea
                id="add_payment_notes"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={addPaymentNotes}
                onChange={(e) => setAddPaymentNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddPaymentDialog(false)}
              disabled={isAddingPayment}
            >
              Annuler
            </Button>
            <Button onClick={handleAddPayment} disabled={isAddingPayment}>
              {isAddingPayment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
