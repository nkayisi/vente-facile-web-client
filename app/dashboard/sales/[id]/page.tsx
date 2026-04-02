"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatDateTime } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getSale,
  cancelSale,
  markReceiptPrinted,
  Sale,
  SaleStatus,
} from "@/actions/sales.actions";
import {
  assignPdfToPrintWindow,
  closePrintTabIfBlank,
  generateReceiptPdfUrl,
  openPrintTab,
  ReceiptData,
} from "@/lib/receipt-printer";

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
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

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
    if (!session?.accessToken || !organization?.id || !sale) return;

    const printTab = openPrintTab();
    setIsPrinting(true);

    try {
      // Charger les paramètres de l'organisation pour l'en-tête/pied de page
      const { getOrganizationSettings } = await import("@/actions/settings.actions");
      const settingsResult = await getOrganizationSettings(session.accessToken, organization.id);

      // Generate receipt data
      const receiptData: ReceiptData = {
        orgName: organization.name || "Vente Facile",
        orgAddress: organization.address || undefined,
        orgPhone: organization.phone || undefined,
        registerName: sale.register_name || undefined,
        cashierName: sale.sold_by_name,
        reference: sale.reference,
        date: new Date(sale.sale_date).toLocaleString("fr-CD"),
        customerName: sale.customer_name || undefined,
        customerPhone: sale.customer_phone || undefined,
        items: sale.items?.map(item => ({
          name: item.product_name,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          discount_percentage: parseFloat(item.discount_percentage),
          total: parseFloat(item.total),
        })) || [],
        subtotal: parseFloat(sale.subtotal),
        taxAmount: parseFloat(sale.tax_amount),
        discountAmount: parseFloat(sale.discount_amount),
        globalDiscountPercent: parseFloat(sale.discount_percentage),
        total: parseFloat(sale.total),
        payments: sale.payments?.map(p => ({
          method: p.payment_method_name,
          amount: parseFloat(p.amount),
          currency: p.currency,
        })) || [],
        amountPaid: parseFloat(sale.amount_paid),
        change: parseFloat(sale.change_amount),
        currency: sale.currency,
        receiptHeader: settingsResult.success && settingsResult.data?.receipt_header ? settingsResult.data.receipt_header : undefined,
        receiptFooter: settingsResult.success && settingsResult.data?.receipt_footer ? settingsResult.data.receipt_footer : undefined,
        isCreditSale: sale.sale_type === "credit",
        amountDue: parseFloat(sale.amount_due),
      };

      const paperWidth = (settingsResult.success && settingsResult.data?.receipt_paper_width === 80 ? 80 : 58) as 58 | 80;
      const pdfUrl = generateReceiptPdfUrl(receiptData, paperWidth);
      const pdfOutcome = assignPdfToPrintWindow(printTab, pdfUrl, {
        filename: `recu-${sale.reference}.pdf`,
      });

      // Mark as printed
      const result = await markReceiptPrinted(session.accessToken, organization.id, sale.id);
      if (result.success && result.data) {
        setSale(result.data);
        toast.success("Reçu prêt", {
          description:
            pdfOutcome === "opened"
              ? "PDF ouvert et enregistré — utilisez Thermer ou Partager pour imprimer."
              : "Reçu téléchargé — l’onglet n’a pas pu s’ouvrir ; ouvrez le fichier dans Thermer.",
        });
      }
    } catch (error) {
      closePrintTabIfBlank(printTab);
      console.error("Error printing receipt:", error);
      toast.error("Erreur lors de l'impression du reçu");
    } finally {
      setIsPrinting(false);
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
          {!sale.receipt_printed && (
            <Button
              variant="outline"
              onClick={handlePrintReceipt}
              disabled={isPrinting}
              className="hover:bg-orange-50"
            >
              {isPrinting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Receipt className="h-4 w-4 mr-2" />
              )}
              {isPrinting ? "Impression..." : "Imprimer le reçu"}
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              className="text-red-600 border-red-600 hover:bg-red-50"
              onClick={() => setShowCancelDialog(true)}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Annuler
            </Button>
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
              {parseFloat(sale.discount_amount) > 0 && (
                <div className="flex justify-between text-sm text-orange-600">
                  <span className="flex items-center gap-1">
                    <Percent className="h-3 w-3" />
                    Remise
                    {parseFloat(sale.discount_percentage) > 0 && ` (${sale.discount_percentage}%)`}
                  </span>
                  <span>-{formatPrice(sale.discount_amount)}</span>
                </div>
              )}
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
                        <span className="font-medium">{parseFloat(item.quantity).toFixed(0)}</span>
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
    </div>
  );
}
